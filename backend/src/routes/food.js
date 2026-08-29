import { Router } from 'express'
import multer from 'multer'
import { requireAuth } from '../auth/middleware.js'
import { analyzeFoodPhoto, estimateFoodByName } from '../agent/foodAgent.js'
import { createMeal, addFoodItem } from '../db/repo/nutrition.js'
import fs from 'node:fs'
import path from 'node:path'
import { config } from '../config.js'
import { one, run } from '../db/index.js'
import { publish } from '../realtime/hub.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\/(jpe?g|png|webp|heic|heif)$/.test(file.mimetype)),
})

const router = Router()
router.use(requireAuth)

router.get('/status', (req, res) => {
  res.json({
    enabled: config.vision.enabled,
    provider: config.vision.provider,
    model: config.vision.model,
  })
})

/**
 * POST /api/food/analyze  (multipart: photo=<image>)
 * Analyze only — returns items + totals for the user to review before logging.
 */
router.post('/analyze', upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Attach an image as field "photo" (jpeg/png/webp/heic).' })
  try {
    const result = await analyzeFoodPhoto(req.user.id, req.file.buffer, req.file.mimetype, String(req.body?.hint || '').slice(0, 120))
    res.json(result)
  } catch (err) {
    res.status(err.status || 502).json({ error: err.message })
  }
})

/**
 * POST /api/food/analyze-and-log  (multipart: photo, fields: slot?, note?)
 * One-shot: analyze the photo and immediately create the meal from the result.
 */
router.post('/analyze-and-log', upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Attach an image as field "photo".' })
  try {
    const result = await analyzeFoodPhoto(req.user.id, req.file.buffer, req.file.mimetype, String(req.body?.hint || '').slice(0, 120))
    if (!result.isFood || result.items.length === 0) {
      return res.status(422).json({ error: 'No food detected in this photo.', result })
    }
    const hour = new Date().getHours()
    const slot = req.body?.slot || (hour < 11 ? 'breakfast' : hour < 15 ? 'lunch' : hour < 18 ? 'snack' : 'dinner')
    const mealId = createMeal(req.user.id, {
      slot,
      name: result.dishName,
      note: req.body?.note || result.notes || null,
      photoPath: result.photoPath,
      source: 'photo-agent',
      items: result.items.map((i) => ({ ...i, source: 'photo-agent' })),
    })
    publish(req.user.id, 'nutrition', { mealId, source: 'photo-agent' })
    res.status(201).json({ mealId, ...result })
  } catch (err) {
    res.status(err.status || 502).json({ error: err.message })
  }
})

/**
 * POST /api/food/log-by-name  { name, slot? }
 * Manual add without a photo: food dictionary first, text-only AI estimate otherwise.
 */
router.post('/log-by-name', async (req, res) => {
  const name = String(req.body?.name || '').trim().slice(0, 120)
  if (!name) return res.status(400).json({ error: 'Provide the food name as "name".' })
  try {
    const result = await estimateFoodByName(req.user.id, name)
    if (!result.isFood || result.items.length === 0) {
      return res.status(422).json({ error: `Could not estimate nutrition for "${name}".` })
    }
    const hour = new Date().getHours()
    const slot = req.body?.slot || (hour < 11 ? 'breakfast' : hour < 15 ? 'lunch' : hour < 18 ? 'snack' : 'dinner')
    const mealId = createMeal(req.user.id, {
      slot,
      name: result.dishName,
      note: result.notes || null,
      source: 'photo-agent',
      items: result.items.map((i) => ({ ...i, source: 'photo-agent' })),
    })
    publish(req.user.id, 'nutrition', { mealId, source: 'log-by-name' })
    res.status(201).json({ mealId, ...result })
  } catch (err) {
    res.status(err.status || 502).json({ error: err.message })
  }
})

/**
 * POST /api/food/meals/:id/correct  { name }
 * The user says the AI got a photo meal wrong: re-analyze the stored photo with
 * their name as ground truth, replace the meal's items, and remember the food.
 */
router.post('/meals/:id/correct', async (req, res) => {
  const name = String(req.body?.name || '').trim().slice(0, 120)
  if (!name) return res.status(400).json({ error: 'Provide the correct dish name as "name".' })
  const meal = one('SELECT * FROM meals WHERE user_id = ? AND id = ?', req.user.id, req.params.id)
  if (!meal) return res.status(404).json({ error: 'Meal not found.' })
  if (!meal.photo_path) return res.status(400).json({ error: 'Only photo-logged meals can be re-analyzed.' })

  const photoAbs = path.join(config.photoDir, path.basename(meal.photo_path))
  if (!fs.existsSync(photoAbs)) return res.status(410).json({ error: 'The original photo is no longer stored.' })

  try {
    const result = await analyzeFoodPhoto(req.user.id, fs.readFileSync(photoAbs), 'image/jpeg', name)
    if (!result.isFood || result.items.length === 0) {
      return res.status(422).json({ error: 'Re-analysis found no food in this photo.', result })
    }
    run('UPDATE meals SET name = ?, note = ? WHERE id = ?', result.dishName, result.notes || meal.note, meal.id)
    run('DELETE FROM food_items WHERE meal_id = ?', meal.id)
    result.items.forEach((item, i) => addFoodItem(req.user.id, meal.id, { ...item, source: 'photo-agent' }, i))
    publish(req.user.id, 'nutrition', { mealId: meal.id, source: 'correction' })
    res.json({ mealId: meal.id, ...result })
  } catch (err) {
    res.status(err.status || 502).json({ error: err.message })
  }
})

export default router
