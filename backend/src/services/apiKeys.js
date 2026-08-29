import { config } from '../config.js'
import { getUserApiKey, setUserApiKey, listUserApiKeys } from '../db/repo/userApiKeys.js'

/**
 * Per-user API keys, managed from Settings → Integrations. A user's saved key
 * wins; the server .env value is the fallback so a self-hosted single-user
 * setup can still configure everything in one place.
 */
const ENV_FALLBACK = {
  'vision.apiKey': () => config.vision.apiKey,
  'spotify.clientId': () => config.spotify.clientId,
  'spotify.clientSecret': () => config.spotify.clientSecret,
}

export const KEY_NAMES = Object.keys(ENV_FALLBACK)

const effective = (userId, name) => getUserApiKey(userId, name) || ENV_FALLBACK[name]()

export const visionKeyFor = (userId) => effective(userId, 'vision.apiKey')

export const visionEnabledFor = (userId) =>
  config.vision.provider !== 'disabled' && Boolean(visionKeyFor(userId))

export const spotifyCredsFor = (userId) => ({
  clientId: effective(userId, 'spotify.clientId'),
  clientSecret: effective(userId, 'spotify.clientSecret'),
})

export function spotifyConfiguredFor(userId) {
  const c = spotifyCredsFor(userId)
  return Boolean(c.clientId && c.clientSecret)
}

export const saveKey = (userId, name, value) => setUserApiKey(userId, name, value)

/** Masked status for the UI — never returns the actual key material. */
export function keyStatus(userId) {
  const saved = new Set(listUserApiKeys(userId))
  const out = {}
  for (const name of KEY_NAMES) {
    const value = effective(userId, name)
    out[name] = {
      set: Boolean(value),
      source: saved.has(name) ? 'saved' : ENV_FALLBACK[name]() ? 'env' : null,
      preview: value ? `…${value.slice(-4)}` : null,
    }
  }
  return out
}
