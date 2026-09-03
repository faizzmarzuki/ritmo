import { config } from '../../config.js'
import { saveRaw } from '../../services/rawStore.js'
import {
  upsertActivity, upsertDaily, upsertSleep, insertHrSamples, insertBodyBattery,
  upsertUserMetric, addBodyComp,
} from '../../db/repo/fitness.js'
import { listConnectionsByProvider, upsertConnection, markSynced, markError } from '../../db/repo/connections.js'
import { startSyncRun, finishSyncRun } from '../../db/repo/ops.js'
import { publish } from '../../realtime/hub.js'
import { logger } from '../../lib/log.js'
import { toDateKey, addDays } from '../../lib/time.js'

const log = logger('garmin:connect')

/**
 * Unofficial Garmin mode: logs into Garmin Connect with the user's own
 * credentials via the `garmin-connect` npm package and polls on an interval.
 * No partner approval needed, works today; near-realtime (default 5 min).
 * The official push mode (official.js/ingest.js) replaces this once a Garmin
 * Health API application is approved.
 */
let GCClient = null
const clients = new Map() // userId -> GarminConnect instance

async function loadLib() {
  if (GCClient) return GCClient
  try {
    const mod = await import('garmin-connect')
    GCClient = mod.GarminConnect ?? mod.default?.GarminConnect
    if (!GCClient) throw new Error('unexpected garmin-connect module shape')
    return GCClient
  } catch {
    throw new Error('garmin-connect package is not installed. Run: npm i garmin-connect')
  }
}

function evictClient(userId) {
  clients.delete(userId)
}

async function clientFor(userId, { email, password, tokens }, { fresh = false } = {}) {
  // A cached client can wedge itself after a failed token refresh — callers
  // pass fresh:true (full poll) or evict on error so we re-login from stored
  // tokens instead of failing silently forever.
  if (fresh) clients.delete(userId)
  if (clients.has(userId)) return clients.get(userId)
  const GC = await loadLib()
  const gc = new GC({ username: email, password })
  if (tokens?.oauth1 && tokens?.oauth2) {
    try {
      gc.loadToken(tokens.oauth1, tokens.oauth2)
    } catch {
      await gc.login()
    }
  } else {
    await gc.login()
  }
  clients.set(userId, gc)
  return gc
}

/**
 * OAuth tokens live AES-encrypted in the access_token column; legacy rows kept
 * them as plaintext JSON in meta.tokens — read those too, they are re-encrypted
 * (and the plaintext stripped) on the next persistTokens call.
 */
function readStoredTokens(conn) {
  if (conn?.accessToken) {
    try {
      return JSON.parse(conn.accessToken)
    } catch {
      /* fall through to legacy */
    }
  }
  return conn?.meta?.tokens ?? null
}

function persistTokens(userId, gc, email, password) {
  try {
    upsertConnection(userId, 'garmin', {
      mode: 'connect',
      externalId: email,
      status: 'connected',
      // encrypted by the connections repo; password rides the COALESCEd
      // token_secret column so passing null keeps the stored one
      accessToken: JSON.stringify({ oauth1: gc.client?.oauth1Token, oauth2: gc.client?.oauth2Token }),
      tokenSecret: password || null,
      meta: { tokens: undefined }, // strip legacy plaintext tokens
    })
  } catch (err) {
    log.warn(`could not persist garmin-connect tokens: ${err.message}`)
  }
}

/** Connect a user in `connect` mode (called from the connect route). */
export async function connectUser(userId, email, password) {
  const gc = await clientFor(userId, { email, password }, { fresh: true })
  persistTokens(userId, gc, email, password)
  return true
}

const iso = (v) => (v ? new Date(v).toISOString() : null)

/**
 * Garmin Connect's dailyStress endpoint carries both the stress chart and the
 * body-battery chart (3-min resolution): bodyBatteryValuesArray = [ts, status,
 * level, version], stressValuesArray = [ts, stress] (negative = off-wrist).
 */
async function fetchVo2max(gc, userId, dateKey) {
  const d = await gc.get(`https://connectapi.garmin.com/metrics-service/metrics/maxmet/daily/${dateKey}/${dateKey}`)
  const g = Array.isArray(d) ? d[0]?.generic : d?.generic
  if (!g || !Number.isFinite(g.vo2MaxPreciseValue ?? g.vo2MaxValue)) return 0
  upsertUserMetric(userId, g.calendarDate ?? dateKey, 'garmin', {
    vo2max: g.vo2MaxPreciseValue ?? g.vo2MaxValue,
    fitnessAge: g.fitnessAge ?? null,
  })
  publish(userId, 'daily', { dateKey, vo2max: g.vo2MaxValue })
  return 1
}

async function fetchBodyBattery(gc, userId, dateKey) {
  const d = await gc.get(`https://connectapi.garmin.com/wellness-service/wellness/dailyStress/${dateKey}`)
  const bb = new Map((d?.bodyBatteryValuesArray || []).map((r) => [r[0], r[2]]))
  const stress = new Map((d?.stressValuesArray || []).map((r) => [r[0], r[1]]))
  const samples = []
  for (const ts of new Set([...bb.keys(), ...stress.keys()])) {
    const level = bb.get(ts)
    const sv = stress.get(ts)
    const stressVal = Number.isFinite(sv) && sv >= 0 ? sv : null
    if (!Number.isFinite(level) && stressVal === null) continue
    samples.push({ ts: new Date(ts).toISOString(), level: Number.isFinite(level) ? level : null, stress: stressVal })
  }
  if (!samples.length) return 0
  insertBodyBattery(userId, samples)
  const levels = samples.map((x) => x.level).filter(Number.isFinite)
  upsertDaily(userId, dateKey, 'garmin', {
    stress_avg: d?.avgStressLevel >= 0 ? d.avgStressLevel : null,
    stress_max: d?.maxStressLevel >= 0 ? d.maxStressLevel : null,
    bb_high: levels.length ? Math.max(...levels) : null,
    bb_low: levels.length ? Math.min(...levels) : null,
  })
  publish(userId, 'bodyBattery', { dateKey, count: samples.length })
  return samples.length
}

async function pollUser(conn) {
  evictClient(conn.user_id)
  const userId = conn.user_id
  const email = conn.external_id || config.garmin.email
  const password = conn.tokenSecret || config.garmin.password
  const gc = await clientFor(userId, { email, password, tokens: readStoredTokens(conn) })
  persistTokens(userId, gc, email, password)

  const today = toDateKey()
  const runId = startSyncRun(userId, 'garmin', 'poll')
  let items = 0

  // 1) Recent activities
  try {
    const acts = await gc.getActivities(0, 20)
    if (acts?.length) saveRaw('garmin', 'connect_activities', acts)
    for (const a of acts || []) {
      const startLocal = a.startTimeLocal ? a.startTimeLocal.replace(' ', 'T') : null
      const durationS = Math.round(a.duration || 0)
      const distanceM = a.distance || 0
      const avgSpeedMs = a.averageSpeed || (durationS > 0 ? distanceM / durationS : null)
      const typeKey = a.activityType?.typeKey || ''
      const sport = /run/i.test(typeKey) ? 'run'
        : /(cycl|bik|ride)/i.test(typeKey) ? 'ride'
        : /swim/i.test(typeKey) ? 'swim'
        : /(walk|hik)/i.test(typeKey) ? 'walk'
        : /(strength|hiit|training)/i.test(typeKey) ? 'strength' : 'other'
      const { isNew } = upsertActivity(userId, {
        provider: 'garmin',
        externalId: a.activityId,
        name: a.activityName || typeKey,
        sport,
        sportRaw: typeKey,
        startTime: iso(a.startTimeGMT ? `${a.startTimeGMT.replace(' ', 'T')}Z` : a.beginTimestamp),
        startLocal,
        dateKey: startLocal ? startLocal.slice(0, 10) : today,
        durationS,
        movingS: Math.round(a.movingDuration || durationS),
        distanceM,
        elevationM: a.elevationGain || 0,
        calories: Math.round(a.calories || 0),
        avgHr: a.averageHR ? Math.round(a.averageHR) : null,
        maxHr: a.maxHR ? Math.round(a.maxHR) : null,
        avgSpeedMs,
        avgPaceSKm: avgSpeedMs > 0 ? 1000 / avgSpeedMs : null,
        steps: a.steps ?? null,
      })
      if (isNew) publish(userId, 'activity', { provider: 'garmin', isNew: true })
      items += 1
    }
  } catch (err) {
    log.warn(`activities poll failed user=${userId}: ${err.message}`)
  }

  // 2) Today + yesterday wellness (steps, HR, sleep, body battery)
  for (const dateKey of [addDays(today, -1), today]) {
    const date = new Date(`${dateKey}T12:00:00`)
    try {
      const hr = await gc.getHeartRate(date)
      if (hr) {
        saveRaw('garmin', `connect_hr_${dateKey}`, hr)
        upsertDaily(userId, dateKey, 'garmin', {
          resting_hr: hr.restingHeartRate ?? null,
          min_hr: hr.minHeartRate ?? null,
          max_hr: hr.maxHeartRate ?? null,
        })
        const samples = (hr.heartRateValues || [])
          .filter((p) => Array.isArray(p) && Number.isFinite(p[1]))
          .map(([ts, bpm]) => ({ ts: new Date(ts).toISOString(), bpm }))
        if (samples.length) {
          insertHrSamples(userId, samples, 'garmin')
          publish(userId, 'heartRate', { dateKey, count: samples.length })
        }
        items += 1
      }
    } catch (err) {
      log.warn(`hr poll ${dateKey}: ${err.message}`)
    }

    try {
      const n = await fetchBodyBattery(gc, userId, dateKey)
      if (n) items += 1
    } catch (err) {
      log.warn(`body battery poll ${dateKey}: ${err.message}`)
    }

    try {
      items += await fetchVo2max(gc, userId, dateKey)
    } catch (err) {
      log.warn(`vo2max poll ${dateKey}: ${err.message}`)
    }

    try {
      const steps = await gc.getSteps(date)
      if (Number.isFinite(steps)) {
        upsertDaily(userId, dateKey, 'garmin', { steps })
        publish(userId, 'daily', { dateKey, steps })
      }
    } catch (err) {
      log.warn(`steps poll ${dateKey}: ${err.message}`)
    }

    try {
      const sleep = await gc.getSleepData(date)
      const dto = sleep?.dailySleepDTO
      if (dto?.sleepTimeSeconds) {
        saveRaw('garmin', `connect_sleep_${dateKey}`, sleep)
        upsertSleep(userId, dateKey, 'garmin', {
          startTs: dto.sleepStartTimestampGMT ? new Date(dto.sleepStartTimestampGMT).toISOString() : null,
          endTs: dto.sleepEndTimestampGMT ? new Date(dto.sleepEndTimestampGMT).toISOString() : null,
          totalMin: Math.round(dto.sleepTimeSeconds / 60),
          deepMin: dto.deepSleepSeconds ? Math.round(dto.deepSleepSeconds / 60) : null,
          lightMin: dto.lightSleepSeconds ? Math.round(dto.lightSleepSeconds / 60) : null,
          remMin: dto.remSleepSeconds ? Math.round(dto.remSleepSeconds / 60) : null,
          awakeMin: dto.awakeSleepSeconds ? Math.round(dto.awakeSleepSeconds / 60) : null,
          score: dto.sleepScores?.overall?.value ?? null,
        })
        publish(userId, 'sleep', { provider: 'garmin', dateKey })
        items += 1
      }
    } catch (err) {
      log.warn(`sleep poll ${dateKey}: ${err.message}`)
    }
  }

  // 3) Weight
  try {
    const w = await gc.getDailyWeightInPounds?.(new Date())
    if (Number.isFinite(w) && w > 0) {
      addBodyComp(userId, { weightKg: Math.round((w / 2.20462) * 10) / 10, source: 'garmin' })
      publish(userId, 'weight', { provider: 'garmin' })
    }
  } catch (err) {
    log.warn(`weight poll: ${err.message}`)
  }

  finishSyncRun(runId, { items })
  markSynced(userId, 'garmin')
  publish(userId, 'sync', { provider: 'garmin', kind: 'poll', items })
}

/**
 * Lightweight HR-only poll: fetches just today's heart-rate chart from Garmin
 * Connect every hrPollSeconds (default 60 s). This is as fresh as Garmin's
 * cloud gets — the watch itself only uploads every few minutes. Second-level
 * truly-live HR comes from the watch's Bluetooth broadcast via /api/hr/live.
 */
async function pollHrOnly(conn) {
  const userId = conn.user_id
  const email = conn.external_id || config.garmin.email
  const gc = await clientFor(userId, { email, password: conn.tokenSecret || config.garmin.password, tokens: readStoredTokens(conn) })
  const today = toDateKey()
  const hr = await gc.getHeartRate(new Date(`${today}T12:00:00`))
  if (!hr?.heartRateValues) return
  const samples = hr.heartRateValues
    .filter((p) => Array.isArray(p) && Number.isFinite(p[1]))
    .map(([ts, bpm]) => ({ ts: new Date(ts).toISOString(), bpm }))
  if (!samples.length) return
  insertHrSamples(userId, samples, 'garmin')
  upsertDaily(userId, today, 'garmin', {
    resting_hr: hr.restingHeartRate ?? null,
    min_hr: hr.minHeartRate ?? null,
    max_hr: hr.maxHeartRate ?? null,
  })
  const last = samples[samples.length - 1]
  publish(userId, 'heartRate', { dateKey: today, count: samples.length, bpm: last.bpm, ts: last.ts })
  try {
    await fetchBodyBattery(gc, userId, today)
  } catch (err) {
    log.warn(`fast bb poll: ${err.message}`)
  }
}

let timer = null
let hrTimer = null

export function startPolling() {
  if (config.garmin.mode !== 'connect') return
  const intervalMs = Math.max(60, config.garmin.pollSeconds) * 1000
  const tick = async () => {
    const conns = listConnectionsByProvider('garmin').filter((c) => c.mode === 'connect')
    for (const conn of conns) {
      try {
        await pollUser(conn)
      } catch (err) {
        log.error(`poll failed user=${conn.user_id}: ${err.message}`)
        markError(conn.user_id, 'garmin', err.message)
      }
    }
  }
  timer = setInterval(tick, intervalMs)
  timer.unref?.()
  setTimeout(tick, 5000).unref?.()
  log.info(`garmin-connect polling every ${intervalMs / 1000}s`)

  const hrIntervalMs = Math.max(30, config.garmin.hrPollSeconds) * 1000
  const hrTick = async () => {
    const conns = listConnectionsByProvider('garmin').filter((c) => c.mode === 'connect')
    for (const conn of conns) {
      try {
        await pollHrOnly(conn)
      } catch (err) {
        log.warn(`hr fast poll failed user=${conn.user_id}: ${err.message}`)
        evictClient(conn.user_id)
      }
    }
  }
  hrTimer = setInterval(hrTick, hrIntervalMs)
  hrTimer.unref?.()
  log.info(`garmin heart-rate fast poll every ${hrIntervalMs / 1000}s`)
}

export const pollNow = async (userId) => {
  const conn = listConnectionsByProvider('garmin').find((c) => c.user_id === userId)
  if (!conn) throw new Error('Garmin not connected')
  await pollUser(conn)
}
