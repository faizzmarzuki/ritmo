import { Router } from 'express'
import path from 'node:path'
import { config } from '../config.js'
import { requireAuth } from '../auth/middleware.js'
import { buildSummary, buildWorkouts, buildProgress, buildNutritionDay } from '../services/summary.js'
import { listActivities, getActivity, getStream, addBodyComp, listBodyComp, insertHrSamples, latestHr } from '../db/repo/fitness.js'
import {
  listMeals, createMeal, addFoodItem, deleteFoodItem, deleteMeal, addHydration,
} from '../db/repo/nutrition.js'
import { listGoals, setGoalDone } from '../db/repo/users.js'
import { toDateKey } from '../lib/time.js'
import { publish } from '../realtime/hub.js'

const router = Router()
router.use(requireAuth)

const PERIODS = new Set(['today', 'week', 'month', 'year'])
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const dateKeyParam = (v) => (DATE_RE.test(String(v || '')) ? v : toDateKey())

// ── dashboard ─────────────────────────────────────────────────────────────────
router.get('/summary', (req, res) => {
  const period = PERIODS.has(req.query.period) ? req.query.period : 'today'
  res.json(buildSummary(req.user.id, period))
})

// ── workouts ──────────────────────────────────────────────────────────────────
router.get('/workouts', (req, res) => res.json(buildWorkouts(req.user.id)))

router.get('/activities', (req, res) => {
  res.json(listActivities(req.user.id, {
    from: req.query.from, to: req.query.to,
    sport: req.query.sport, limit: Math.min(Number(req.query.limit) || 100, 1000),
  }))
})

router.get('/activities/:id', (req, res) => {
  const act = getActivity(req.user.id, req.params.id)
  if (!act) return res.status(404).json({ error: 'Not found' })
  res.json({
    ...act,
    streams: {
      heartrate: getStream(act.id, 'heartrate'),
      velocity: getStream(act.id, 'velocity'),
      altitude: getStream(act.id, 'altitude'),
    },
  })
})

// ── live heart rate ──────────────────────────────────────────────────────────
/**
 * POST /api/hr/live { bpm } — one sample per beat/second from a browser tab
 * connected to the watch's Bluetooth HR broadcast. Stored under source 'live'
 * and fanned out over SSE so every open page updates instantly.
 */
router.post('/hr/live', (req, res) => {
  const bpm = Math.round(Number(req.body?.bpm))
  if (!Number.isFinite(bpm) || bpm < 25 || bpm > 250) {
    return res.status(400).json({ error: 'bpm must be a number between 25 and 250' })
  }
  const ts = new Date().toISOString()
  insertHrSamples(req.user.id, [{ ts, bpm }], 'live')
  publish(req.user.id, 'heartRate', { bpm, ts, live: true })
  res.status(201).json({ ok: true })
})

router.get('/hr/latest', (req, res) => res.json(latestHr(req.user.id) ?? {}))

// ── nutrition ─────────────────────────────────────────────────────────────────
router.get('/nutrition', (req, res) => {
  const dateKey = dateKeyParam(req.query.date)
  res.json(buildNutritionDay(req.user.id, dateKey, listMeals))
})

router.post('/meals', (req, res) => {
  const { slot, name, items, note, eatenAt } = req.body || {}
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items[] required' })
  for (const i of items) {
    if (!i.name) return res.status(400).json({ error: 'each item needs a name' })
  }
  const id = createMeal(req.user.id, { slot, name, items, note, eatenAt })
  publish(req.user.id, 'nutrition', { mealId: id })
  res.status(201).json({ id })
})

router.post('/meals/:mealId/items', (req, res) => {
  const id = addFoodItem(req.user.id, req.params.mealId, req.body || {})
  publish(req.user.id, 'nutrition', { mealId: req.params.mealId })
  res.status(201).json({ id })
})

router.delete('/meals/:mealId', (req, res) => {
  deleteMeal(req.user.id, req.params.mealId)
  publish(req.user.id, 'nutrition', {})
  res.json({ ok: true })
})

router.delete('/food-items/:id', (req, res) => {
  deleteFoodItem(req.user.id, req.params.id)
  publish(req.user.id, 'nutrition', {})
  res.json({ ok: true })
})

router.post('/hydration', (req, res) => {
  const ml = Number(req.body?.ml)
  if (!Number.isFinite(ml) || ml <= 0 || ml > 5000) return res.status(400).json({ error: 'ml must be 1-5000' })
  addHydration(req.user.id, ml)
  publish(req.user.id, 'hydration', { ml })
  res.status(201).json({ ok: true })
})

// ── progress / weight / goals ────────────────────────────────────────────────
router.get('/progress', (req, res) => res.json(buildProgress(req.user.id)))

router.get('/weights', (req, res) => res.json(listBodyComp(req.user.id, { from: req.query.from, to: req.query.to })))

router.post('/weights', (req, res) => {
  const kg = Number(req.body?.weightKg)
  if (!Number.isFinite(kg) || kg <= 20 || kg > 400) return res.status(400).json({ error: 'weightKg must be 20-400' })
  const id = addBodyComp(req.user.id, { weightKg: kg, bodyFatPct: req.body?.bodyFatPct, source: 'manual' })
  publish(req.user.id, 'weight', {})
  res.status(201).json({ id })
})

router.get('/goals', (req, res) => res.json(listGoals(req.user.id)))

router.post('/goals/:id/log', (req, res) => {
  setGoalDone(req.user.id, req.params.id, dateKeyParam(req.body?.date), Boolean(req.body?.done ?? true))
  publish(req.user.id, 'goals', {})
  res.json({ ok: true })
})

// ── photos ────────────────────────────────────────────────────────────────────
router.get('/photos/:name', (req, res) => {
  const name = path.basename(req.params.name)
  res.sendFile(path.join(config.photoDir, name), (err) => {
    if (err) res.status(404).json({ error: 'Not found' })
  })
})

export default router
