import { all, one, run } from '../index.js'
import { randomId } from '../../lib/crypto.js'

const keyOf = (name) => String(name).trim().toLowerCase().replace(/\s+/g, ' ')

/** Save (or reinforce) a food the user has named themselves — user names are ground truth. */
export function learnFood(userId, name, totals = {}, grams = null) {
  const nameKey = keyOf(name)
  if (!nameKey) return
  const existing = one('SELECT id FROM food_memory WHERE user_id = ? AND name_key = ?', userId, nameKey)
  if (existing) {
    run(
      `UPDATE food_memory SET display_name = ?, grams = COALESCE(?, grams),
         kcal = COALESCE(?, kcal), protein = COALESCE(?, protein), carbs = COALESCE(?, carbs),
         fat = COALESCE(?, fat), fiber = COALESCE(?, fiber), sugar = COALESCE(?, sugar),
         times_used = times_used + 1, updated_at = datetime('now')
       WHERE id = ?`,
      name.trim(), grams, totals.kcal ?? null, totals.protein ?? null, totals.carbs ?? null,
      totals.fat ?? null, totals.fiber ?? null, totals.sugar ?? null, existing.id,
    )
  } else {
    run(
      `INSERT INTO food_memory (id, user_id, name_key, display_name, grams, kcal, protein, carbs, fat, fiber, sugar)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      randomId(), userId, nameKey, name.trim(), grams, totals.kcal ?? null, totals.protein ?? null,
      totals.carbs ?? null, totals.fat ?? null, totals.fiber ?? null, totals.sugar ?? null,
    )
  }
}

export const listFoodMemory = (userId, limit = 20) =>
  all(
    'SELECT display_name, grams, kcal, protein, carbs, fat FROM food_memory WHERE user_id = ? ORDER BY times_used DESC, updated_at DESC LIMIT ?',
    userId, limit,
  )
