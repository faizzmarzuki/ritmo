import path from 'node:path'
import fs from 'node:fs'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { config, configWarnings, ROOT } from './config.js'
import { migrate } from './db/index.js'
import { logger } from './lib/log.js'
import { requireAuth } from './auth/middleware.js'
import { subscribe, connectedClients } from './realtime/hub.js'
import { recentWebhooks, recentSyncRuns } from './db/repo/ops.js'
import authRoutes from './routes/auth.js'
import providerAuthRoutes from './routes/providerAuth.js'
import webhookRoutes from './routes/webhooks.js'
import dataRoutes from './routes/data.js'
import foodRoutes from './routes/food.js'
import spotifyRoutes from './routes/spotify.js'
import chatRoutes from './routes/chat.js'
import settingsRoutes from './routes/settings.js'
import { startPolling } from './providers/garmin/connectPoller.js'

const log = logger('server')

migrate()

const app = express()
app.set('trust proxy', 1)
app.use(cors({ origin: [config.appUrl], credentials: true }))
app.use(express.json({ limit: '2mb' }))
app.use(cookieParser())

// ── health / diagnostics ──────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    time: new Date().toISOString(),
    warnings: configWarnings(),
    providers: {
      garmin: { configured: config.garmin.enabled, mode: config.garmin.mode, webhook: `${config.publicUrl}/api/webhooks/garmin` },
      vision: { configured: config.vision.enabled, provider: config.vision.provider, model: config.vision.model },
      spotify: { configured: config.spotify.enabled, redirectUri: `${config.publicUrl.replace('//localhost', '//127.0.0.1')}/api/auth/spotify/callback` },
    },
  })
})

app.get('/api/diagnostics', requireAuth, (req, res) => {
  res.json({
    sseClients: connectedClients(req.user.id),
    recentWebhooks: recentWebhooks(25),
    recentSyncRuns: recentSyncRuns(req.user.id),
  })
})

// ── realtime ──────────────────────────────────────────────────────────────────
app.get('/api/events', requireAuth, (req, res) => subscribe(req.user.id, res))

// ── routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes)
app.use('/api/auth', providerAuthRoutes)   // /api/auth/garmin/*, /api/auth/connections
app.use('/api/webhooks', webhookRoutes)    // public — providers call these
app.use('/api/food', foodRoutes)
app.use('/api', spotifyRoutes)
app.use('/api', chatRoutes)         // /api/auth/spotify/*, /api/spotify/*
app.use('/api', settingsRoutes)     // /api/settings/keys
app.use('/api', dataRoutes)

// ── static frontend (frontend/dist, when built) ───────────────────────────────
const distDir = path.resolve(ROOT, '../frontend/dist')
const hasDist = fs.existsSync(path.join(distDir, 'index.html'))
if (hasDist) {
  app.use(express.static(distDir))
  // SPA fallback for client-side routes; API 404s stay JSON.
  app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(distDir, 'index.html')))
}

app.use((req, res) => res.status(404).json({ error: `No route ${req.method} ${req.path}` }))

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  log.error(`unhandled: ${err.stack || err.message}`)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(config.port, () => {
  log.info(`project-fitness backend on http://localhost:${config.port}`)
  log.info(`public URL: ${config.publicUrl}`)
  for (const w of configWarnings()) log.warn(w)
  startPolling()
})
