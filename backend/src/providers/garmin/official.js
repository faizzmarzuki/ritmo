import { config } from '../../config.js'
import { oauthRequest, sign } from './oauth1.js'
import { getConnection, upsertConnection } from '../../db/repo/connections.js'
import { logger } from '../../lib/log.js'

const log = logger('garmin:official')

const REQ_TOKEN_URL = 'https://connectapi.garmin.com/oauth-service/oauth/request_token'
const AUTHORIZE_URL = 'https://connect.garmin.com/oauthConfirm'
const ACCESS_TOKEN_URL = 'https://connectapi.garmin.com/oauth-service/oauth/access_token'
export const API = 'https://apis.garmin.com'

const parseForm = (text) => Object.fromEntries(new URLSearchParams(text))

/** Step 1: get a request token, return the URL to redirect the user to. */
export async function beginAuth(callbackUrl) {
  const text = await oauthRequest('POST', `${REQ_TOKEN_URL}?oauth_callback=${encodeURIComponent(callbackUrl)}`)
  const { oauth_token, oauth_token_secret } = parseForm(text)
  return {
    url: `${AUTHORIZE_URL}?oauth_token=${oauth_token}&oauth_callback=${encodeURIComponent(callbackUrl)}`,
    requestToken: oauth_token,
    requestSecret: oauth_token_secret,
  }
}

/** Step 2: exchange verifier for permanent token pair (Garmin OAuth1 tokens don't expire). */
export async function completeAuth({ requestToken, requestSecret, verifier }) {
  const text = await oauthRequest('POST', `${ACCESS_TOKEN_URL}?oauth_verifier=${verifier}`, {
    token: requestToken,
    tokenSecret: requestSecret,
  })
  return parseForm(text) // { oauth_token, oauth_token_secret }
}

export async function apiGet(userId, path) {
  const conn = getConnection(userId, 'garmin')
  if (!conn?.accessToken) throw new Error('Garmin (official) not connected')
  const url = `${API}${path}`
  const header = sign({ method: 'GET', url, token: conn.accessToken, tokenSecret: conn.tokenSecret })
  const res = await fetch(url, { headers: { Authorization: header } })
  if (!res.ok) throw new Error(`Garmin API ${res.status}: ${(await res.text()).slice(0, 300)}`)
  return res.json()
}

/** Fetch the Garmin user id after connect so webhook payloads can be routed. */
export async function fetchUserId(userId) {
  const data = await apiGet(userId, '/wellness-api/rest/user/id')
  return data?.userId
}

export function storeTokens(userId, tokens, garminUserId) {
  upsertConnection(userId, 'garmin', {
    mode: 'official',
    externalId: garminUserId,
    accessToken: tokens.oauth_token,
    tokenSecret: tokens.oauth_token_secret,
    status: 'connected',
  })
  log.info(`stored official Garmin tokens for user=${userId} garminId=${garminUserId}`)
}

/**
 * Ask Garmin to (re)send data for a time window through the push webhook.
 * Health API backfill endpoints accept up to 90 days per call.
 */
export async function requestBackfill(userId, summary, fromUnix, toUnix) {
  const path = `/wellness-api/rest/backfill/${summary}?summaryStartTimeInSeconds=${fromUnix}&summaryEndTimeInSeconds=${toUnix}`
  const conn = getConnection(userId, 'garmin')
  const url = `${API}${path}`
  const header = sign({ method: 'GET', url, token: conn.accessToken, tokenSecret: conn.tokenSecret })
  const res = await fetch(url, { headers: { Authorization: header } })
  if (res.status !== 202 && !res.ok) {
    throw new Error(`backfill ${summary} ${res.status}: ${(await res.text()).slice(0, 200)}`)
  }
  log.info(`backfill requested: ${summary} for user=${userId}`)
}
