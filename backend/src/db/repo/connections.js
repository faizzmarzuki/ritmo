import { all, one, run } from '../index.js'
import { decrypt, encrypt, randomId } from '../../lib/crypto.js'

const hydrate = (row) => {
  if (!row) return null
  let meta = {}
  try {
    meta = JSON.parse(row.meta || '{}')
  } catch {
    meta = {}
  }
  return {
    ...row,
    accessToken: decrypt(row.access_token),
    refreshToken: decrypt(row.refresh_token),
    tokenSecret: decrypt(row.token_secret),
    meta,
  }
}

export const getConnection = (userId, provider) =>
  hydrate(one('SELECT * FROM connections WHERE user_id = ? AND provider = ?', userId, provider))

export const listConnections = (userId) =>
  all('SELECT * FROM connections WHERE user_id = ?', userId).map(hydrate)

export const findByExternalId = (provider, externalId) =>
  hydrate(one('SELECT * FROM connections WHERE provider = ? AND external_id = ?', provider, String(externalId)))

export const listConnectionsByProvider = (provider) =>
  all("SELECT * FROM connections WHERE provider = ? AND status = 'connected'", provider).map(hydrate)

export function upsertConnection(userId, provider, data) {
  const existing = one('SELECT id, meta FROM connections WHERE user_id = ? AND provider = ?', userId, provider)
  const id = existing?.id || randomId()
  let meta = {}
  try {
    meta = { ...JSON.parse(existing?.meta || '{}'), ...(data.meta || {}) }
  } catch {
    meta = data.meta || {}
  }

  run(
    `INSERT INTO connections (id, user_id, provider, mode, external_id, status, access_token, refresh_token,
                              token_secret, expires_at, scope, meta, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(user_id, provider) DO UPDATE SET
       mode          = excluded.mode,
       external_id   = excluded.external_id,
       status        = excluded.status,
       access_token  = excluded.access_token,
       refresh_token = COALESCE(excluded.refresh_token, connections.refresh_token),
       token_secret  = COALESCE(excluded.token_secret, connections.token_secret),
       expires_at    = excluded.expires_at,
       scope         = excluded.scope,
       meta          = excluded.meta,
       last_error    = NULL,
       updated_at    = datetime('now')`,
    id, userId, provider,
    data.mode ?? null,
    data.externalId != null ? String(data.externalId) : null,
    data.status || 'connected',
    encrypt(data.accessToken),
    encrypt(data.refreshToken),
    encrypt(data.tokenSecret),
    data.expiresAt ?? null,
    data.scope ?? null,
    JSON.stringify(meta),
  )
  return getConnection(userId, provider)
}

export const markSynced = (userId, provider) =>
  run("UPDATE connections SET last_sync_at = datetime('now'), last_error = NULL WHERE user_id = ? AND provider = ?", userId, provider)

export const markError = (userId, provider, message) =>
  run('UPDATE connections SET last_error = ? WHERE user_id = ? AND provider = ?', String(message).slice(0, 500), userId, provider)

export const deleteConnection = (userId, provider) =>
  run('DELETE FROM connections WHERE user_id = ? AND provider = ?', userId, provider)

// ── OAuth handshake state ─────────────────────────────────────────────────────
export function saveOAuthState(userId, provider, extra = {}) {
  const state = randomId(24)
  run('INSERT INTO oauth_states (state, user_id, provider, verifier) VALUES (?, ?, ?, ?)', state, userId, provider, extra.verifier ?? null)
  return state
}

export function takeOAuthState(state) {
  const row = one("SELECT * FROM oauth_states WHERE state = ? AND created_at > datetime('now', '-30 minutes')", state)
  if (row) run('DELETE FROM oauth_states WHERE state = ?', state)
  run("DELETE FROM oauth_states WHERE created_at <= datetime('now', '-1 day')")
  return row || null
}
