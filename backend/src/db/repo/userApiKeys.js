import { all, one, run } from '../index.js'
import { encrypt, decrypt } from '../../lib/crypto.js'

export const getUserApiKey = (userId, key) =>
  decrypt(one('SELECT value FROM user_api_keys WHERE user_id = ? AND key = ?', userId, key)?.value)

export function setUserApiKey(userId, key, value) {
  if (value === null || value === undefined || value === '') {
    run('DELETE FROM user_api_keys WHERE user_id = ? AND key = ?', userId, key)
    return
  }
  run(
    `INSERT INTO user_api_keys (user_id, key, value, updated_at) VALUES (?,?,?,datetime('now'))
     ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    userId, key, encrypt(value),
  )
}

export const listUserApiKeys = (userId) =>
  all('SELECT key FROM user_api_keys WHERE user_id = ?', userId).map((r) => r.key)
