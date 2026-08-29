import { all, one, run, tx } from '../index.js'
import { randomId } from '../../lib/crypto.js'
import { toDateKey } from '../../lib/time.js'

export const SLOTS = [
  { id: 'breakfast', name: 'Breakfast' },
  { id: 'lunch', name: 'Lunch' },
  { id: 'snack', name: 'Snack' },
  { id: 'dinner', name: 'Dinner' },
]

const slotName = (slot) => SLOTS.find((s) => s.id === slot)?.name || 'Meal'

/** Creates the meal and its items in one transaction — a photo log is all-or-nothing. */
export const createMeal = tx((userId, meal) => {
  const id = randomId()
  const eatenAt = meal.eatenAt || new Date().toISOString()
  const dateKey = meal.dateKey || toDateKey(eatenAt)
  run(
    'INSERT INTO meals (id, user_id, date_key, slot, name, eaten_at, photo_path, note, source) VALUES (?,?,?,?,?,?,?,?,?)',
    id, userId, dateKey, meal.slot || 'snack', meal.name || slotName(meal.slot), eatenAt,
    meal.photoPath ?? null, meal.note ?? null, meal.source || 'manual',
  )
  ;(meal.items || []).forEach((item, i) => addFoodItem(userId, id, item, i))
  return id
})

export function addFoodItem(userId, mealId, item, position = 0) {
  const id = randomId()
  run(
    `INSERT INTO food_items (id, meal_id, user_id, name, portion, grams, kcal, protein, carbs, fat, fiber, sugar, confidence, source, position)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    id, mealId, userId, item.name, item.portion ?? null, item.grams ?? null,
    Number(item.kcal) || 0, Number(item.protein) || 0, Number(item.carbs) || 0, Number(item.fat) || 0,
    Number(item.fiber) || 0, Number(item.sugar) || 0, item.confidence ?? null, item.source || 'manual', position,
  )
  return id
}

export const deleteFoodItem = (userId, itemId) => run('DELETE FROM food_items WHERE user_id = ? AND id = ?', userId, itemId)
export const deleteMeal = (userId, mealId) => run('DELETE FROM meals WHERE user_id = ? AND id = ?', userId, mealId)

export function listMeals(userId, dateKey) {
  const meals = all('SELECT * FROM meals WHERE user_id = ? AND date_key = ? ORDER BY eaten_at', userId, dateKey)
  const items = all(
    `SELECT f.* FROM food_items f JOIN meals m ON m.id = f.meal_id
     WHERE m.user_id = ? AND m.date_key = ? ORDER BY f.position`,
    userId, dateKey,
  )
  return meals.map((m) => ({ ...m, items: items.filter((i) => i.meal_id === m.id) }))
}

export const nutritionTotals = (userId, from, to) =>
  one(
    `SELECT COALESCE(SUM(f.kcal),0) kcal, COALESCE(SUM(f.protein),0) protein, COALESCE(SUM(f.carbs),0) carbs,
            COALESCE(SUM(f.fat),0) fat, COALESCE(SUM(f.fiber),0) fiber, COALESCE(SUM(f.sugar),0) sugar
     FROM food_items f JOIN meals m ON m.id = f.meal_id
     WHERE m.user_id = ? AND m.date_key BETWEEN ? AND ?`,
    userId, from, to,
  )

export const nutritionByDay = (userId, from, to) =>
  all(
    `SELECT m.date_key, COALESCE(SUM(f.kcal),0) kcal
     FROM meals m LEFT JOIN food_items f ON f.meal_id = m.id
     WHERE m.user_id = ? AND m.date_key BETWEEN ? AND ?
     GROUP BY m.date_key ORDER BY m.date_key`,
    userId, from, to,
  )

export const nutritionBySlot = (userId, dateKey) =>
  all(
    `SELECT m.slot, COALESCE(SUM(f.kcal),0) kcal
     FROM meals m LEFT JOIN food_items f ON f.meal_id = m.id
     WHERE m.user_id = ? AND m.date_key = ?
     GROUP BY m.slot`,
    userId, dateKey,
  )

// ── vision agent bookkeeping ─────────────────────────────────────────────────
export function saveAnalysis(userId, entry) {
  const id = randomId()
  run(
    `INSERT INTO food_analyses (id, user_id, image_sha, photo_path, provider, model, prompt_ver, result, tokens_in, tokens_out, latency_ms)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    id, userId, entry.imageSha, entry.photoPath ?? null, entry.provider ?? null, entry.model ?? null,
    entry.promptVer ?? null, JSON.stringify(entry.result), entry.tokensIn ?? null, entry.tokensOut ?? null, entry.latencyMs ?? null,
  )
  return id
}

export function findAnalysisByHash(userId, imageSha) {
  const row = one('SELECT * FROM food_analyses WHERE user_id = ? AND image_sha = ? ORDER BY created_at DESC LIMIT 1', userId, imageSha)
  if (!row) return null
  try {
    return { ...row, result: JSON.parse(row.result) }
  } catch {
    return null
  }
}

// ── hydration ────────────────────────────────────────────────────────────────
export function addHydration(userId, ml, ts = new Date().toISOString()) {
  const id = randomId()
  run('INSERT INTO hydration_events (id, user_id, date_key, ts, ml) VALUES (?,?,?,?,?)', id, userId, toDateKey(ts), ts, Math.round(ml))
  return id
}

export const hydrationByDay = (userId, from, to) =>
  all(
    'SELECT date_key, COALESCE(SUM(ml),0) ml FROM hydration_events WHERE user_id = ? AND date_key BETWEEN ? AND ? GROUP BY date_key ORDER BY date_key',
    userId, from, to,
  )

export const hydrationTotal = (userId, dateKey) =>
  one('SELECT COALESCE(SUM(ml),0) ml FROM hydration_events WHERE user_id = ? AND date_key = ?', userId, dateKey)?.ml ?? 0
