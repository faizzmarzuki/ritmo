import { all, one, run, tx } from '../index.js'
import { hashPassword, randomId, verifyPassword } from '../../lib/crypto.js'
import { toDateKey } from '../../lib/time.js'

export const DEFAULT_SETTINGS = {
  units: 'metric',
  calorieGoal: 2200,
  proteinGoal: 160,
  carbsGoal: 250,
  fatGoal: 70,
  weeklyDistanceGoal: 25,
  waterGoalMl: 2500,
  burnGoal: 700,
  quitDate: null,
  cigarettesPerDay: 15,
  costPerCigarette: 0.6,
  startWeight: null,
  goalWeight: null,
  heightCm: 178,
  avatar: null,
  // gear — free text, edited in Settings › General
  gearShoes: '',
  gearWatch: '',
  gearOther: '',
}

const SEED_GOALS = [
  'No sweet drinks',
  'No smoking',
  'Drink enough water',
  '10,000 steps',
  'Sleep by 11 PM',
]

export function createUser({ email, password, name }) {
  const id = randomId()
  return tx(() => {
    run('INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)', id, email.toLowerCase(), hashPassword(password), name)
    run('INSERT INTO settings (user_id, json) VALUES (?, ?)', id, JSON.stringify(DEFAULT_SETTINGS))
    SEED_GOALS.forEach((label, i) => {
      run('INSERT INTO goals (id, user_id, label, position) VALUES (?, ?, ?, ?)', randomId(8), id, label, i)
    })
    return { id, email: email.toLowerCase(), name }
  })()
}

export const findUserByEmail = (email) => one('SELECT * FROM users WHERE email = ?', String(email || '').toLowerCase())
export const findUserById = (id) => one('SELECT id, email, name, created_at FROM users WHERE id = ?', id)

export function authenticate(email, password) {
  const user = findUserByEmail(email)
  if (!user || !verifyPassword(password, user.password_hash)) return null
  return { id: user.id, email: user.email, name: user.name }
}

const SESSION_DAYS = 30

export function createSession(userId) {
  const token = randomId(32)
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString()
  run('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)', token, userId, expires)
  return { token, expiresAt: expires }
}

export function resolveSession(token) {
  if (!token) return null
  const row = one("SELECT * FROM sessions WHERE token = ? AND expires_at > datetime('now')", token)
  if (!row) return null
  return findUserById(row.user_id)
}

export const destroySession = (token) => run('DELETE FROM sessions WHERE token = ?', token)

export function getSettings(userId) {
  const row = one('SELECT json FROM settings WHERE user_id = ?', userId)
  let parsed = {}
  try {
    parsed = JSON.parse(row?.json || '{}')
  } catch {
    parsed = {}
  }
  return { ...DEFAULT_SETTINGS, ...parsed }
}

export function updateSettings(userId, patch) {
  const next = { ...getSettings(userId), ...patch }
  run(
    'INSERT INTO settings (user_id, json) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET json = excluded.json',
    userId,
    JSON.stringify(next),
  )
  return next
}

// ── habit goals ───────────────────────────────────────────────────────────────
export const listGoals = (userId) => all('SELECT * FROM goals WHERE user_id = ? AND archived = 0 ORDER BY position', userId)

export function setGoalDone(userId, goalId, dateKey, done) {
  run(
    `INSERT INTO goal_logs (user_id, goal_id, date_key, done) VALUES (?, ?, ?, ?)
     ON CONFLICT(goal_id, date_key) DO UPDATE SET done = excluded.done`,
    userId, goalId, dateKey, done ? 1 : 0,
  )
}

/** Consecutive days ending today (or yesterday, so a not-yet-ticked today doesn't reset it). */
export function goalStreak(goalId, today = toDateKey()) {
  const rows = all(
    'SELECT date_key FROM goal_logs WHERE goal_id = ? AND done = 1 AND date_key <= ? ORDER BY date_key DESC LIMIT 400',
    goalId, today,
  ).map((r) => r.date_key)
  if (!rows.length) return 0
  const set = new Set(rows)
  const cursor = new Date(`${today}T00:00:00`)
  if (!set.has(today)) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  for (;;) {
    const key = toDateKey(cursor)
    if (!set.has(key)) break
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export const goalDoneOn = (goalId, dateKey) =>
  Boolean(one('SELECT done FROM goal_logs WHERE goal_id = ? AND date_key = ?', goalId, dateKey)?.done)
