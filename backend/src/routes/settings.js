import { Router } from 'express'
import { requireAuth } from '../auth/middleware.js'
import { KEY_NAMES, saveKey, keyStatus } from '../services/apiKeys.js'
import { publish } from '../realtime/hub.js'

const router = Router()

router.get('/settings/keys', requireAuth, (req, res) => {
  res.set('Cache-Control', 'no-store') // credential status must never be cached
  res.json({ keys: keyStatus(req.user.id) })
})

/**
 * Body: { "vision.apiKey": "sk-…", "spotify.clientId": null, … }
 * Omitted keys are unchanged; null or "" clears the user's saved key
 * (falls back to server/.env if set there).
 */
router.put('/settings/keys', requireAuth, (req, res) => {
  const body = req.body ?? {}
  const touched = KEY_NAMES.filter((name) => name in body)
  if (!touched.length) return res.status(400).json({ error: 'No known keys in request body.' })
  for (const name of touched) {
    const value = body[name]
    if (value !== null && typeof value !== 'string') {
      return res.status(400).json({ error: `${name} must be a string or null.` })
    }
  }
  for (const name of touched) {
    saveKey(req.user.id, name, typeof body[name] === 'string' ? body[name].trim() : null)
  }
  // nudge cards that depend on provider configuration (e.g. Spotify connect button)
  publish(req.user.id, 'connection', { provider: 'settings', status: 'updated' })
  res.json({ keys: keyStatus(req.user.id) })
})

export default router
