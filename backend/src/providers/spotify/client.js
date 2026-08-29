import { config } from '../../config.js'
import { requestJson, HttpError } from '../../lib/http.js'
import { getConnection, upsertConnection, markError } from '../../db/repo/connections.js'
import { logger } from '../../lib/log.js'

const log = logger('spotify')
export const API = 'https://api.spotify.com/v1'

// Spotify no longer allows literal "localhost" redirect URIs — loopback IP is fine.
export const redirectUri = () =>
  `${config.publicUrl.replace('//localhost', '//127.0.0.1')}/api/auth/spotify/callback`

const SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'streaming',            // Web Playback SDK (full songs in the browser, Premium)
  'user-read-email',
  'user-read-private',
].join(' ')

const basicAuth = () =>
  'Basic ' + Buffer.from(`${config.spotify.clientId}:${config.spotify.clientSecret}`).toString('base64')

export function authorizeUrl(state) {
  const params = new URLSearchParams({
    client_id: config.spotify.clientId,
    response_type: 'code',
    redirect_uri: redirectUri(),
    scope: SCOPES,
    state,
  })
  return `https://accounts.spotify.com/authorize?${params}`
}

const tokenRequest = (body) =>
  requestJson('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { Authorization: basicAuth(), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  })

export const exchangeCode = (code) =>
  tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri() })

export async function accessTokenFor(userId) {
  const conn = getConnection(userId, 'spotify')
  if (!conn || conn.status !== 'connected') {
    throw Object.assign(new Error('Spotify is not connected'), { status: 400 })
  }
  const now = Math.floor(Date.now() / 1000)
  if (conn.expires_at && conn.expires_at - now > 300) return conn.accessToken

  try {
    const tok = await tokenRequest({ grant_type: 'refresh_token', refresh_token: conn.refreshToken })
    upsertConnection(userId, 'spotify', {
      externalId: conn.external_id,
      accessToken: tok.access_token,
      // Spotify only returns a new refresh token sometimes; COALESCE keeps the old one
      refreshToken: tok.refresh_token || null,
      expiresAt: now + (tok.expires_in || 3600),
      scope: conn.scope,
      meta: conn.meta,
    })
    return tok.access_token
  } catch (err) {
    markError(userId, 'spotify', `token refresh failed: ${err.message}`)
    throw err
  }
}

/** Call the Spotify Web API for a user. Returns null on 204 (nothing playing). */
export async function api(userId, method, path, body) {
  const token = await accessTokenFor(userId)
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 204) return null
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    log.warn(`${method} ${path} → ${res.status} ${text.slice(0, 200)}`)
    throw new HttpError(res.status, res.statusText, text)
  }
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    // Control endpoints (play/pause against a Web Playback SDK device) can
    // return 200 with a plain-text request id — success, just not JSON.
    return null
  }
}

/** Normalize GET /me/player into what the player UI needs. */
export function normalizePlayer(p) {
  if (!p || !p.item) return { isPlaying: false, track: null }
  const item = p.item
  return {
    isPlaying: Boolean(p.is_playing),
    progressMs: p.progress_ms ?? 0,
    shuffle: Boolean(p.shuffle_state),
    repeat: p.repeat_state || 'off',
    device: p.device ? { name: p.device.name, type: p.device.type, volume: p.device.volume_percent } : null,
    track: {
      id: item.id,
      uri: item.uri,
      name: item.name,
      artists: (item.artists || [{ name: item.show?.name }]).map((a) => a.name).filter(Boolean).join(', '),
      album: item.album?.name ?? item.show?.name ?? '',
      artUrl: item.album?.images?.at(-1)?.url ?? item.images?.at(-1)?.url ?? null,
      artUrlLarge: item.album?.images?.[0]?.url ?? item.images?.[0]?.url ?? null,
      durationMs: item.duration_ms ?? 0,
    },
  }
}
