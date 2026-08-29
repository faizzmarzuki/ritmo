import { all, one, run } from '../index.js'
import { randomId } from '../../lib/crypto.js'

export function recordWebhook(provider, payload, externalId) {
  const id = randomId()
  run('INSERT INTO webhook_events (id, provider, external_id, payload) VALUES (?,?,?,?)', id, provider, externalId ?? null, JSON.stringify(payload))
  return id
}

export const completeWebhook = (id, status, error) =>
  run("UPDATE webhook_events SET processed_at = datetime('now'), status = ?, error = ? WHERE id = ?", status, error ? String(error).slice(0, 500) : null, id)

export const recentWebhooks = (limit = 25) =>
  all('SELECT id, provider, external_id, received_at, processed_at, status, error FROM webhook_events ORDER BY received_at DESC LIMIT ?', limit)

export function startSyncRun(userId, provider, kind) {
  const id = randomId()
  run('INSERT INTO sync_runs (id, user_id, provider, kind) VALUES (?,?,?,?)', id, userId, provider, kind)
  return id
}

export const finishSyncRun = (id, { items = 0, error } = {}) =>
  run(
    "UPDATE sync_runs SET finished_at = datetime('now'), items = ?, status = ?, error = ? WHERE id = ?",
    items, error ? 'failed' : 'ok', error ? String(error).slice(0, 500) : null, id,
  )

export const lastSyncRun = (userId, provider) =>
  one('SELECT * FROM sync_runs WHERE user_id = ? AND provider = ? ORDER BY started_at DESC LIMIT 1', userId, provider)

export const recentSyncRuns = (userId, limit = 20) =>
  all('SELECT * FROM sync_runs WHERE user_id = ? ORDER BY started_at DESC LIMIT ?', userId, limit)
