import { Router } from 'express'
import { config } from '../config.js'
import * as spotify from '../providers/spotify/client.js'
import { saveOAuthState, takeOAuthState, upsertConnection, deleteConnection } from '../db/repo/connections.js'
import { requireAuth } from '../auth/middleware.js'
import { spotifyConfiguredFor } from '../services/apiKeys.js'
import { publish } from '../realtime/hub.js'
import { logger } from '../lib/log.js'

const log = logger('spotify:routes')
const router = Router()

const DEMO_PLAYER = {
  isPlaying: true,
  progressMs: 83_000,
  shuffle: false,
  repeat: 'off',
  device: { name: 'Demo device', type: 'Computer', volume: 60 },
  track: {
    id: 'demo',
    uri: 'spotify:track:demo',
    name: 'Yes I\'m A Mess',
    artists: 'AJR',
    album: 'Yes I\'m A Mess',
    artUrl: null,
    artUrlLarge: null,
    durationMs: 218_000,
  },
}

// ── OAuth ─────────────────────────────────────────────────────────────────────
router.get('/auth/spotify/connect', requireAuth, (req, res) => {
  if (!spotifyConfiguredFor(req.user.id)) {
    return res.status(503).json({ error: 'Spotify is not configured — add your Client ID & Secret in Settings → Integrations.' })
  }
  const state = saveOAuthState(req.user.id, 'spotify')
  res.json({ url: spotify.authorizeUrl(req.user.id, state) })
})

router.get('/auth/spotify/callback', async (req, res) => {
  const { code, state, error } = req.query
  const saved = takeOAuthState(state)
  if (!saved || saved.provider !== 'spotify') return res.redirect(`${config.appUrl}/settings?connect=spotify&status=invalid-state`)
  if (error || !code) return res.redirect(`${config.appUrl}/settings?connect=spotify&status=denied`)
  try {
    const tok = await spotify.exchangeCode(saved.user_id, code)
    upsertConnection(saved.user_id, 'spotify', {
      accessToken: tok.access_token,
      refreshToken: tok.refresh_token,
      expiresAt: Math.floor(Date.now() / 1000) + (tok.expires_in || 3600),
      scope: tok.scope,
    })
    // fetch profile for display name + product tier (premium?)
    try {
      const me = await spotify.api(saved.user_id, 'GET', '/me')
      upsertConnection(saved.user_id, 'spotify', {
        externalId: me.id,
        accessToken: tok.access_token,
        refreshToken: null, // COALESCE keeps stored one
        expiresAt: Math.floor(Date.now() / 1000) + (tok.expires_in || 3600),
        scope: tok.scope,
        meta: { displayName: me.display_name, product: me.product },
      })
    } catch (err) {
      log.warn(`profile fetch failed: ${err.message}`)
    }
    publish(saved.user_id, 'connection', { provider: 'spotify', status: 'connected' })
    res.redirect(`${config.appUrl}/settings?connect=spotify&status=ok`)
  } catch (err) {
    log.error(`callback failed: ${err.message}`)
    res.redirect(`${config.appUrl}/settings?connect=spotify&status=error`)
  }
})

router.post('/auth/spotify/disconnect', requireAuth, (req, res) => {
  deleteConnection(req.user.id, 'spotify')
  publish(req.user.id, 'connection', { provider: 'spotify', status: 'disconnected' })
  res.json({ ok: true })
})

// ── player ────────────────────────────────────────────────────────────────────
router.get('/spotify/now-playing', requireAuth, async (req, res) => {
  if (config.spotify.demo) return res.json(DEMO_PLAYER)
  try {
    const p = await spotify.api(req.user.id, 'GET', '/me/player?additional_types=track,episode')
    res.json(spotify.normalizePlayer(p))
  } catch (err) {
    res.status(err.status === 400 ? 400 : 502).json({ error: err.message })
  }
})

/** Web Playback SDK needs the raw OAuth token in the browser. */
router.get('/spotify/token', requireAuth, async (req, res) => {
  try {
    const token = await spotify.accessTokenFor(req.user.id)
    res.json({ accessToken: token })
  } catch (err) {
    res.status(err.status || 502).json({ error: err.message })
  }
})

const CONTROLS = {
  play: ['PUT', '/me/player/play'],
  pause: ['PUT', '/me/player/pause'],
  next: ['POST', '/me/player/next'],
  previous: ['POST', '/me/player/previous'],
}

router.post('/spotify/control/:action', requireAuth, async (req, res) => {
  if (config.spotify.demo) return res.json({ ok: true, demo: true })
  const ctl = CONTROLS[req.params.action]
  if (!ctl) return res.status(400).json({ error: `Unknown action "${req.params.action}"` })
  try {
    await spotify.api(req.user.id, ctl[0], ctl[1])
    res.json({ ok: true })
  } catch (err) {
    // 404 = no active device. Devices that are merely idle (app in background)
    // are still listed — wake one by transferring playback to it, then retry.
    if (err.status === 404) {
      try {
        const d = await spotify.api(req.user.id, 'GET', '/me/player/devices')
        const target = d?.devices?.find((x) => x.is_active) ?? d?.devices?.[0]
        if (target) {
          await spotify.api(req.user.id, 'PUT', '/me/player', {
            device_ids: [target.id],
            play: req.params.action === 'play',
          })
          if (!['play', 'pause'].includes(req.params.action)) {
            await spotify.api(req.user.id, ctl[0], ctl[1])
          }
          return res.json({ ok: true, wokeDevice: target.name })
        }
      } catch {
        // fall through to the friendly message
      }
      return res.status(409).json({ error: 'Spotify can\'t reach any of your devices. Open the Spotify app on your phone or computer (it can stay in the background), or press "Play here" to play in this browser.' })
    }
    if (err.status === 403) {
      return res.status(403).json({ error: 'Playback control requires Spotify Premium.' })
    }
    res.status(502).json({ error: err.message })
  }
})

/** Transfer playback to a device (used by the in-browser Web Playback SDK player). */
router.post('/spotify/transfer', requireAuth, async (req, res) => {
  const deviceId = req.body?.deviceId
  if (!deviceId) return res.status(400).json({ error: 'deviceId required' })
  try {
    await spotify.api(req.user.id, 'PUT', '/me/player', { device_ids: [deviceId], play: true })
    res.json({ ok: true })
  } catch (err) {
    if (err.status === 403) return res.status(403).json({ error: 'Transferring playback requires Spotify Premium.' })
    res.status(502).json({ error: err.message })
  }
})

export default router
