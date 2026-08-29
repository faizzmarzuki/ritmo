import crypto from 'node:crypto'
import { config } from '../../config.js'

/**
 * Minimal OAuth 1.0a (HMAC-SHA1) signer for the official Garmin Health API.
 * Garmin still uses three-legged OAuth1 for its Health/Connect Developer APIs.
 */
const enc = (s) => encodeURIComponent(s).replace(/[!*'()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)

export function sign({ method, url, params = {}, token = '', tokenSecret = '' }) {
  const oauth = {
    oauth_consumer_key: config.garmin.consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_version: '1.0',
    ...(token ? { oauth_token: token } : {}),
  }
  const u = new URL(url)
  const allParams = { ...params, ...oauth }
  for (const [k, v] of u.searchParams) allParams[k] = v

  const baseParams = Object.keys(allParams).sort().map((k) => `${enc(k)}=${enc(allParams[k])}`).join('&')
  const base = [method.toUpperCase(), enc(`${u.origin}${u.pathname}`), enc(baseParams)].join('&')
  const key = `${enc(config.garmin.consumerSecret)}&${enc(tokenSecret)}`
  oauth.oauth_signature = crypto.createHmac('sha1', key).update(base).digest('base64')

  const header = 'OAuth ' + Object.keys(oauth).sort().map((k) => `${enc(k)}="${enc(oauth[k])}"`).join(', ')
  return header
}

export async function oauthRequest(method, url, { token, tokenSecret, params } = {}) {
  const header = sign({ method, url, token, tokenSecret, params })
  const res = await fetch(url, { method, headers: { Authorization: header } })
  const text = await res.text()
  if (!res.ok) throw new Error(`Garmin OAuth ${res.status}: ${text.slice(0, 300)}`)
  return text
}
