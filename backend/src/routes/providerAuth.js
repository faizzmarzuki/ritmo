import { Router } from 'express'
import { config } from '../config.js'
import * as garminOfficial from '../providers/garmin/official.js'
import * as garminConnect from '../providers/garmin/connectPoller.js'
import { saveOAuthState, takeOAuthState, upsertConnection, getConnection, deleteConnection, listConnections } from '../db/repo/connections.js'
import { requireAuth } from '../auth/middleware.js'
import { publish } from '../realtime/hub.js'
import { lastSyncRun } from '../db/repo/ops.js'
import { logger } from '../lib/log.js'
import { all } from '../db/index.js'

const log = logger('provider-auth')
const router = Router()

// ── status ────────────────────────────────────────────────────────────────────
router.get('/connections', requireAuth, (req, res) => {
  const conns = listConnections(req.user.id)
  const spotifyConn = conns.find((c) => c.provider === 'spotify')
  res.json({
    garmin: shape(conns.find((c) => c.provider === 'garmin'), req.user.id),
    spotify: spotifyConn
      ? {
          connected: spotifyConn.status === 'connected',
          displayName: spotifyConn.meta?.displayName ?? null,
          premium: spotifyConn.meta?.product === 'premium',
          lastError: spotifyConn.last_error,
        }
      : { connected: false },
    providers: {
      garmin: { configured: config.garmin.enabled, mode: config.garmin.mode },
      spotify: { configured: config.spotify.enabled, demo: config.spotify.demo },
    },
  })
})

function shape(conn, userId) {
  if (!conn) return { connected: false }
  return {
    connected: conn.status === 'connected',
    mode: conn.mode,
    externalId: conn.external_id,
    lastSyncAt: conn.last_sync_at,
    lastError: conn.last_error,
    lastRun: lastSyncRun(userId, conn.provider),
  }
}

// ── Garmin (official OAuth1) ──────────────────────────────────────────────────
router.get('/garmin/connect', requireAuth, async (req, res) => {
  if (config.garmin.mode === 'official') {
    try {
      const callback = `${config.publicUrl}/api/auth/garmin/callback`
      const { url, requestToken, requestSecret } = await garminOfficial.beginAuth(callback)
      saveOAuthState(req.user.id, 'garmin', { verifier: JSON.stringify({ requestToken, requestSecret }) })
      // OAuth1 routes the state via the request token itself
      upsertConnection(req.user.id, 'garmin', { mode: 'official', status: 'pending', meta: { requestToken, requestSecret } })
      return res.json({ url })
    } catch (err) {
      return res.status(502).json({ error: `Garmin request token failed: ${err.message}` })
    }
  }
  if (config.garmin.mode === 'connect') {
    return res.json({ mode: 'connect', needsCredentials: !config.garmin.email })
  }
  res.status(503).json({ error: 'Garmin is disabled on the server (GARMIN_MODE=off).' })
})

router.get('/garmin/callback', async (req, res) => {
  const { oauth_token: requestToken, oauth_verifier: verifier } = req.query
  if (!requestToken || !verifier) return res.redirect(`${config.appUrl}/settings?connect=garmin&status=denied`)
  try {
    // find whichever user has this pending request token
    const pending = all("SELECT * FROM connections WHERE provider = 'garmin' AND status = 'pending'")
      .find((c) => { try { return JSON.parse(c.meta).requestToken === requestToken } catch { return false } })
    if (!pending) return res.redirect(`${config.appUrl}/settings?connect=garmin&status=invalid-state`)
    const meta = JSON.parse(pending.meta)
    const tokens = await garminOfficial.completeAuth({ requestToken, requestSecret: meta.requestSecret, verifier })
    garminOfficial.storeTokens(pending.user_id, tokens, null)
    const garminUserId = await garminOfficial.fetchUserId(pending.user_id).catch(() => null)
    if (garminUserId) {
      upsertConnection(pending.user_id, 'garmin', { mode: 'official', externalId: garminUserId, status: 'connected' })
    }
    publish(pending.user_id, 'connection', { provider: 'garmin', status: 'connected' })
    res.redirect(`${config.appUrl}/settings?connect=garmin&status=ok`)
  } catch (err) {
    log.error(`garmin callback failed: ${err.message}`)
    res.redirect(`${config.appUrl}/settings?connect=garmin&status=error`)
  }
})

// ── Garmin (unofficial connect mode) ─────────────────────────────────────────
router.post('/garmin/connect-credentials', requireAuth, async (req, res) => {
  if (config.garmin.mode !== 'connect') return res.status(400).json({ error: 'Server is not in GARMIN_MODE=connect.' })
  const email = req.body?.email || config.garmin.email
  const password = req.body?.password || config.garmin.password
  if (!email || !password) return res.status(400).json({ error: 'Garmin Connect email and password required (or set GARMIN_EMAIL/GARMIN_PASSWORD).' })
  try {
    await garminConnect.connectUser(req.user.id, email, password)
    publish(req.user.id, 'connection', { provider: 'garmin', status: 'connected' })
    garminConnect.pollNow(req.user.id).catch((err) => log.warn(`initial garmin poll: ${err.message}`))
    res.json({ ok: true })
  } catch (err) {
    res.status(502).json({ error: `Garmin login failed: ${err.message}` })
  }
})

router.post('/garmin/disconnect', requireAuth, (req, res) => {
  deleteConnection(req.user.id, 'garmin')
  publish(req.user.id, 'connection', { provider: 'garmin', status: 'disconnected' })
  res.json({ ok: true })
})

router.post('/garmin/sync', requireAuth, async (req, res) => {
  try {
    if (config.garmin.mode === 'connect') {
      await garminConnect.pollNow(req.user.id)
      return res.json({ ok: true })
    }
    if (config.garmin.mode === 'official') {
      const now = Math.floor(Date.now() / 1000)
      const days = Math.min(Number(req.body?.days) || 30, 90)
      const conn = getConnection(req.user.id, 'garmin')
      if (!conn) return res.status(400).json({ error: 'Garmin not connected' })
      for (const summary of ['dailies', 'sleeps', 'activities', 'stressDetails', 'userMetrics', 'bodyComps']) {
        await garminOfficial.requestBackfill(req.user.id, summary, now - days * 86_400, now)
      }
      return res.json({ ok: true, note: 'Backfill requested — data arrives via webhook shortly.' })
    }
    res.status(503).json({ error: 'Garmin is disabled.' })
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
})

export default router
