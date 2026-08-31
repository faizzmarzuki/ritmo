import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const here = path.dirname(fileURLToPath(import.meta.url))
export const ROOT = path.resolve(here, '..')

dotenv.config({ path: path.join(ROOT, '.env') })

const bool = (v, fallback = false) => {
  if (v === undefined || v === '') return fallback
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase())
}
const int = (v, fallback) => {
  const n = Number.parseInt(v, 10)
  return Number.isFinite(n) ? n : fallback
}

const DATA_DIR = path.resolve(ROOT, process.env.DATA_DIR || './data')

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: int(process.env.PORT, 4000),
  publicUrl: (process.env.PUBLIC_URL || 'http://localhost:4000').replace(/\/$/, ''),
  appUrl: (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, ''),

  dataDir: DATA_DIR,
  dbFile: path.join(DATA_DIR, 'fitness.db'),
  rawDir: path.join(DATA_DIR, 'raw'),
  photoDir: path.join(DATA_DIR, 'photos'),

  sessionSecret: process.env.SESSION_SECRET || 'dev-insecure-session-secret',
  tokenEncKey: process.env.TOKEN_ENC_KEY || 'dev-insecure-token-encryption-key',

  garmin: {
    mode: process.env.GARMIN_MODE || 'off', // official | connect | off
    consumerKey: process.env.GARMIN_CONSUMER_KEY || '',
    consumerSecret: process.env.GARMIN_CONSUMER_SECRET || '',
    email: process.env.GARMIN_EMAIL || '',
    password: process.env.GARMIN_PASSWORD || '',
    pollSeconds: int(process.env.GARMIN_POLL_SECONDS, 300),
    hrPollSeconds: int(process.env.GARMIN_HR_POLL_SECONDS, 60),
    get enabled() {
      if (this.mode === 'official') return Boolean(this.consumerKey && this.consumerSecret)
      if (this.mode === 'connect') return Boolean(this.email && this.password)
      return false
    },
  },

  spotify: {
    clientId: process.env.SPOTIFY_CLIENT_ID || '',
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
    demo: bool(process.env.SPOTIFY_DEMO, false),
    get enabled() {
      return Boolean(this.clientId && this.clientSecret)
    },
  },

  chat: {
    model: process.env.CHAT_MODEL || 'gpt-5-mini',
    // Chat always talks to an OpenAI-compatible endpoint; OPENAI_API_KEY backs it
    // even when the vision provider is anthropic/google (VISION_API_KEY is theirs).
    apiKey: process.env.OPENAI_API_KEY || '',
  },

  vision: {
    provider: process.env.VISION_PROVIDER || 'openai',
    model: process.env.VISION_MODEL || 'gpt-5-mini',
    baseUrl: (process.env.VISION_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
    apiKey: process.env.VISION_API_KEY || '',
    maxEdge: int(process.env.VISION_MAX_EDGE, 768),
    cache: bool(process.env.VISION_CACHE, true),
    get enabled() {
      // Server-wide credential present. Per-user saved keys can still enable the
      // agent for individual accounts when this is false (openai provider only).
      return this.provider !== 'disabled'
        && Boolean(this.apiKey || (this.provider === 'openai' && config.chat.apiKey))
    },
  },
}

for (const dir of [config.dataDir, config.rawDir, config.photoDir]) {
  fs.mkdirSync(dir, { recursive: true })
}

/** Vision/chat requests carry API keys in headers — refuse to send them over plain http. */
export function visionBaseUrl() {
  if (!/^https:\/\//i.test(config.vision.baseUrl)) {
    throw Object.assign(new Error('VISION_BASE_URL must be an https URL.'), { status: 503 })
  }
  return config.vision.baseUrl
}

/** Warnings surfaced on boot and via GET /api/health so misconfiguration is obvious. */
export function configWarnings() {
  const w = []
  if (config.sessionSecret.startsWith('dev-insecure')) w.push('SESSION_SECRET is not set — sessions are insecure.')
  if (config.tokenEncKey.startsWith('dev-insecure')) w.push('TOKEN_ENC_KEY is not set — provider tokens are weakly encrypted.')
  if (config.garmin.mode === 'off') w.push('Garmin is disabled (GARMIN_MODE=off).')
  else if (!config.garmin.enabled) w.push(`Garmin mode "${config.garmin.mode}" is missing credentials.`)
  if (config.vision.provider === 'disabled') w.push('Food-photo agent is disabled (VISION_PROVIDER=disabled).')
  else if (!config.vision.enabled) {
    w.push(config.vision.provider === 'openai'
      ? 'No server-wide OpenAI key (VISION_API_KEY or OPENAI_API_KEY) — each user must add their own in Settings → Integrations.'
      : `Vision provider "${config.vision.provider}" is missing VISION_API_KEY.`)
  }
  if (!config.spotify.enabled) w.push('Spotify is not configured (no Client ID/Secret — Settings → Integrations, or SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET).')
  if (config.publicUrl.includes('localhost')) {
    w.push('PUBLIC_URL points at localhost — Garmin push webhooks cannot reach this server. Use a tunnel for official-mode realtime push.')
  }
  return w
}
