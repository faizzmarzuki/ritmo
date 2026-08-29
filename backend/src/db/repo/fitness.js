import { all, one, run, tx } from '../index.js'
import { randomId } from '../../lib/crypto.js'
import { toDateKey } from '../../lib/time.js'

// ── activities ───────────────────────────────────────────────────────────────
/** Upsert keyed on (user, provider, external id) so replayed webhooks are idempotent. */
export function upsertActivity(userId, a) {
  const existing = one(
    'SELECT id FROM activities WHERE user_id = ? AND provider = ? AND external_id = ?',
    userId, a.provider, String(a.externalId),
  )
  const id = existing?.id || randomId()
  run(
    `INSERT INTO activities (id, user_id, provider, external_id, name, sport, sport_raw, start_time, start_local,
       date_key, timezone, duration_s, moving_s, distance_m, elevation_m, calories, avg_hr, max_hr,
       avg_speed_ms, avg_pace_s_km, steps, raw_path, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
     ON CONFLICT(user_id, provider, external_id) DO UPDATE SET
       name=excluded.name, sport=excluded.sport, sport_raw=excluded.sport_raw,
       start_time=excluded.start_time, start_local=excluded.start_local, date_key=excluded.date_key,
       timezone=excluded.timezone, duration_s=excluded.duration_s, moving_s=excluded.moving_s,
       distance_m=excluded.distance_m, elevation_m=excluded.elevation_m, calories=excluded.calories,
       avg_hr=excluded.avg_hr, max_hr=excluded.max_hr, avg_speed_ms=excluded.avg_speed_ms,
       avg_pace_s_km=excluded.avg_pace_s_km, steps=excluded.steps,
       raw_path=COALESCE(excluded.raw_path, activities.raw_path), updated_at=datetime('now')`,
    id, userId, a.provider, String(a.externalId), a.name ?? null, a.sport ?? 'other', a.sportRaw ?? null,
    a.startTime, a.startLocal ?? null, a.dateKey, a.timezone ?? null,
    Math.round(a.durationS || 0), Math.round(a.movingS || 0), a.distanceM || 0, a.elevationM || 0,
    Math.round(a.calories || 0), a.avgHr ?? null, a.maxHr ?? null, a.avgSpeedMs ?? null,
    a.avgPaceSKm ?? null, a.steps ?? null, a.rawPath ?? null,
  )
  return { id, isNew: !existing }
}

export const deleteActivity = (userId, provider, externalId) =>
  run('DELETE FROM activities WHERE user_id = ? AND provider = ? AND external_id = ?', userId, provider, String(externalId))

export const getActivity = (userId, id) => one('SELECT * FROM activities WHERE user_id = ? AND id = ?', userId, id)

export const listActivities = (userId, { from, to, limit = 200, sport } = {}) => {
  const clauses = ['user_id = ?']
  const args = [userId]
  if (from) { clauses.push('date_key >= ?'); args.push(from) }
  if (to) { clauses.push('date_key <= ?'); args.push(to) }
  if (sport) { clauses.push('sport = ?'); args.push(sport) }
  args.push(limit)
  return all(`SELECT * FROM activities WHERE ${clauses.join(' AND ')} ORDER BY start_time DESC LIMIT ?`, ...args)
}

export const latestActivityTime = (userId, provider) =>
  one('SELECT MAX(start_time) AS t FROM activities WHERE user_id = ? AND provider = ?', userId, provider)?.t || null

export const saveStream = (activityId, kind, data) =>
  run(
    `INSERT INTO activity_streams (activity_id, kind, data) VALUES (?, ?, ?)
     ON CONFLICT(activity_id, kind) DO UPDATE SET data = excluded.data`,
    activityId, kind, JSON.stringify(data),
  )

export function getStream(activityId, kind) {
  const row = one('SELECT data FROM activity_streams WHERE activity_id = ? AND kind = ?', activityId, kind)
  if (!row) return null
  try {
    return JSON.parse(row.data)
  } catch {
    return null
  }
}

// ── daily metrics ────────────────────────────────────────────────────────────
const DAILY_COLS = [
  'steps', 'distance_m', 'floors', 'calories_active', 'calories_bmr', 'resting_hr',
  'min_hr', 'max_hr', 'avg_hr', 'stress_avg', 'stress_max', 'bb_high', 'bb_low',
  'bb_charged', 'bb_drained', 'intensity_minutes', 'raw_path',
]

/** COALESCE(excluded, existing) — a partial push never wipes fields another push filled in. */
export function upsertDaily(userId, dateKey, provider, values) {
  const cols = DAILY_COLS.filter((c) => values[c] !== undefined && values[c] !== null)
  const sql = `INSERT INTO daily_metrics (user_id, date_key, provider${cols.length ? ', ' + cols.join(', ') : ''}, updated_at)
     VALUES (?, ?, ?${cols.map(() => ', ?').join('')}, datetime('now'))
     ON CONFLICT(user_id, date_key, provider) DO UPDATE SET
       ${cols.map((c) => `${c} = COALESCE(excluded.${c}, daily_metrics.${c})`).join(', ')}${cols.length ? ',' : ''}
       updated_at = datetime('now')`
  run(sql, userId, dateKey, provider, ...cols.map((c) => values[c]))
}

export const getDaily = (userId, from, to) =>
  all('SELECT * FROM daily_metrics WHERE user_id = ? AND date_key BETWEEN ? AND ? ORDER BY date_key', userId, from, to)

// ── samples ──────────────────────────────────────────────────────────────────
export const insertHrSamples = tx((userId, samples, source) => {
  for (const s of samples) {
    if (!s?.ts || !Number.isFinite(s.bpm)) continue
    run('INSERT OR REPLACE INTO hr_samples (user_id, ts, bpm, source) VALUES (?, ?, ?, ?)', userId, s.ts, Math.round(s.bpm), source)
  }
})

export const getHrSamples = (userId, fromIso, toIso) =>
  all('SELECT ts, bpm FROM hr_samples WHERE user_id = ? AND ts BETWEEN ? AND ? ORDER BY ts', userId, fromIso, toIso)

export const latestHr = (userId) =>
  one('SELECT ts, bpm FROM hr_samples WHERE user_id = ? ORDER BY ts DESC LIMIT 1', userId)

export const insertBodyBattery = tx((userId, samples) => {
  for (const s of samples) {
    if (!s?.ts) continue
    run('INSERT OR REPLACE INTO body_battery_samples (user_id, ts, level, stress) VALUES (?, ?, ?, ?)',
      userId, s.ts, s.level ?? null, s.stress ?? null)
  }
})

export const getBodyBattery = (userId, fromIso, toIso) =>
  all('SELECT ts, level, stress FROM body_battery_samples WHERE user_id = ? AND ts BETWEEN ? AND ? ORDER BY ts', userId, fromIso, toIso)

export const latestBodyBattery = (userId) =>
  one('SELECT ts, level, stress FROM body_battery_samples WHERE user_id = ? AND level IS NOT NULL ORDER BY ts DESC LIMIT 1', userId)

// ── sleep / vo2 / body composition ───────────────────────────────────────────
export const upsertSleep = (userId, dateKey, provider, s) =>
  run(
    `INSERT INTO sleep_records (user_id, date_key, provider, start_ts, end_ts, total_min, deep_min, light_min, rem_min, awake_min, score, raw_path)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(user_id, date_key, provider) DO UPDATE SET
       start_ts=excluded.start_ts, end_ts=excluded.end_ts, total_min=excluded.total_min,
       deep_min=excluded.deep_min, light_min=excluded.light_min, rem_min=excluded.rem_min,
       awake_min=excluded.awake_min, score=COALESCE(excluded.score, sleep_records.score),
       raw_path=COALESCE(excluded.raw_path, sleep_records.raw_path)`,
    userId, dateKey, provider, s.startTs ?? null, s.endTs ?? null, s.totalMin ?? null,
    s.deepMin ?? null, s.lightMin ?? null, s.remMin ?? null, s.awakeMin ?? null, s.score ?? null, s.rawPath ?? null,
  )

export const getSleep = (userId, from, to) =>
  all('SELECT * FROM sleep_records WHERE user_id = ? AND date_key BETWEEN ? AND ? ORDER BY date_key', userId, from, to)

export const upsertUserMetric = (userId, dateKey, provider, m) =>
  run(
    `INSERT INTO user_metrics (user_id, date_key, provider, vo2max, fitness_age) VALUES (?,?,?,?,?)
     ON CONFLICT(user_id, date_key, provider) DO UPDATE SET
       vo2max=COALESCE(excluded.vo2max, user_metrics.vo2max),
       fitness_age=COALESCE(excluded.fitness_age, user_metrics.fitness_age)`,
    userId, dateKey, provider, m.vo2max ?? null, m.fitnessAge ?? null,
  )

export const getUserMetrics = (userId, from, to) =>
  all('SELECT * FROM user_metrics WHERE user_id = ? AND date_key BETWEEN ? AND ? ORDER BY date_key', userId, from, to)

export const latestUserMetric = (userId) =>
  one('SELECT * FROM user_metrics WHERE user_id = ? AND vo2max IS NOT NULL ORDER BY date_key DESC LIMIT 1', userId)

export function addBodyComp(userId, entry) {
  const ts = entry.ts || new Date().toISOString()
  const id = randomId()
  run(
    'INSERT INTO body_comp (id, user_id, ts, date_key, weight_kg, bmi, body_fat_pct, muscle_kg, source) VALUES (?,?,?,?,?,?,?,?,?)',
    id, userId, ts, entry.dateKey || toDateKey(ts), entry.weightKg ?? null, entry.bmi ?? null,
    entry.bodyFatPct ?? null, entry.muscleKg ?? null, entry.source || 'manual',
  )
  return id
}

export const listBodyComp = (userId, { from, to, limit = 1000 } = {}) => {
  const clauses = ['user_id = ?', 'weight_kg IS NOT NULL']
  const args = [userId]
  if (from) { clauses.push('date_key >= ?'); args.push(from) }
  if (to) { clauses.push('date_key <= ?'); args.push(to) }
  args.push(limit)
  return all(`SELECT * FROM body_comp WHERE ${clauses.join(' AND ')} ORDER BY ts ASC LIMIT ?`, ...args)
}

export const latestWeight = (userId) =>
  one('SELECT * FROM body_comp WHERE user_id = ? AND weight_kg IS NOT NULL ORDER BY ts DESC LIMIT 1', userId)

export const firstWeight = (userId) =>
  one('SELECT * FROM body_comp WHERE user_id = ? AND weight_kg IS NOT NULL ORDER BY ts ASC LIMIT 1', userId)

export const weightBefore = (userId, dateKey) =>
  one('SELECT * FROM body_comp WHERE user_id = ? AND weight_kg IS NOT NULL AND date_key < ? ORDER BY ts DESC LIMIT 1', userId, dateKey)
