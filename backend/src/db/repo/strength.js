import { all, one, run, tx } from '../index.js'
import { randomId } from '../../lib/crypto.js'

/** Replace the exercise breakdown attached to a logged gym session. */
export const replaceStrengthExercises = tx((userId, activityId, exercises) => {
  run('DELETE FROM strength_exercises WHERE user_id = ? AND activity_id = ?', userId, activityId)
  exercises.forEach((ex, i) => {
    run(
      'INSERT INTO strength_exercises (id, activity_id, user_id, exercise_key, position, rest_s, sets) VALUES (?,?,?,?,?,?,?)',
      randomId(), activityId, userId, ex.key, i, ex.restS ?? null, JSON.stringify(ex.reps),
    )
  })
})

export const listStrengthExercises = (userId, activityId) =>
  all(
    'SELECT exercise_key, rest_s, sets FROM strength_exercises WHERE user_id = ? AND activity_id = ? ORDER BY position',
    userId, activityId,
  ).map((r) => {
    let reps = []
    try { reps = JSON.parse(r.sets) } catch { /* keep [] */ }
    return { key: r.exercise_key, restS: r.rest_s, reps: Array.isArray(reps) ? reps : [] }
  })

/** Every exercise logged on/after `fromDateKey`, with its session's start time — feeds muscle recovery. */
export const listRecentStrengthWork = (userId, fromDateKey) =>
  all(
    `SELECT se.exercise_key, a.start_time, a.date_key
     FROM strength_exercises se JOIN activities a ON a.id = se.activity_id
     WHERE se.user_id = ? AND a.date_key >= ?`,
    userId, fromDateKey,
  )

// ── scraped exercise library (backend/scripts/scrape-exercises.js) ───────────
const parseJson = (s, fallback) => {
  try {
    const v = JSON.parse(s)
    return Array.isArray(v) ? v : fallback
  } catch {
    return fallback
  }
}

/** The whole library, trimmed to what the exercise picker needs. */
export const listExerciseLibrary = () =>
  all('SELECT slug, name, gif_path, muscles, equipment FROM exercises ORDER BY name').map((r) => ({
    slug: r.slug,
    name: r.name,
    hasGif: Boolean(r.gif_path),
    muscles: parseJson(r.muscles, []),
    equipment: parseJson(r.equipment, []),
  }))

export const getExerciseBySlug = (slug) =>
  one('SELECT slug, name, gif_path, muscles FROM exercises WHERE slug = ?', slug)

/** Batch lookup with parsed muscle tags — used to validate logs and map recovery. */
export const getExercisesBySlugs = (slugs) => {
  if (!slugs.length) return []
  return all(
    `SELECT slug, name, muscles FROM exercises WHERE slug IN (${slugs.map(() => '?').join(',')})`,
    ...slugs,
  ).map((r) => ({ slug: r.slug, name: r.name, muscles: parseJson(r.muscles, []) }))
}
