import { saveRaw } from '../../services/rawStore.js'
import { normalizeActivity, normalizeDaily, normalizeSleep, normalizeStressDetails } from './normalize.js'
import {
  upsertActivity, upsertDaily, upsertSleep, insertHrSamples, insertBodyBattery,
  upsertUserMetric, addBodyComp,
} from '../../db/repo/fitness.js'
import { findByExternalId, markSynced } from '../../db/repo/connections.js'
import { publish } from '../../realtime/hub.js'
import { logger } from '../../lib/log.js'
import { toDateKey } from '../../lib/time.js'

const log = logger('garmin:ingest')

/**
 * Official Health API push payloads arrive as { dailies: [...], sleeps: [...],
 * activities: [...], stressDetails: [...], userMetrics: [...], bodyComps: [...] }.
 * Each summary carries userId/userAccessToken which we map to our user.
 */
export function ingestPush(body) {
  const buckets = Object.entries(body || {}).filter(([, v]) => Array.isArray(v))
  let total = 0
  for (const [kind, items] of buckets) {
    for (const item of items) {
      const externalId = item.userId || item.userAccessToken
      const conn = externalId ? findByExternalId('garmin', externalId) : null
      if (!conn) {
        log.warn(`push ${kind} for unknown garmin user ${externalId} — skipped`)
        continue
      }
      try {
        ingestSummary(conn.user_id, kind, item)
        total += 1
      } catch (err) {
        log.error(`failed to ingest ${kind}: ${err.message}`)
      }
    }
  }
  return total
}

export function ingestSummary(userId, kind, item) {
  switch (kind) {
    case 'activities':
    case 'activityDetails': {
      const summary = kind === 'activityDetails' ? item.summary ?? item : item
      const rawPath = saveRaw('garmin', `activity_${summary.summaryId || 'x'}`, item)
      const { isNew } = upsertActivity(userId, { ...normalizeActivity(summary), rawPath })
      markSynced(userId, 'garmin')
      publish(userId, 'activity', { provider: 'garmin', isNew })
      break
    }
    case 'dailies': {
      const rawPath = saveRaw('garmin', `daily_${item.calendarDate || 'x'}`, item)
      const { dateKey, daily, hrSamples } = normalizeDaily(item)
      upsertDaily(userId, dateKey, 'garmin', { ...daily, raw_path: rawPath })
      if (hrSamples.length) insertHrSamples(userId, hrSamples, 'garmin')
      markSynced(userId, 'garmin')
      publish(userId, 'daily', { provider: 'garmin', dateKey })
      break
    }
    case 'sleeps': {
      const rawPath = saveRaw('garmin', `sleep_${item.calendarDate || 'x'}`, item)
      const { dateKey, sleep } = normalizeSleep(item)
      upsertSleep(userId, dateKey, 'garmin', { ...sleep, rawPath })
      publish(userId, 'sleep', { provider: 'garmin', dateKey })
      break
    }
    case 'stressDetails': {
      const samples = normalizeStressDetails(item)
      if (samples.length) {
        insertBodyBattery(userId, samples)
        publish(userId, 'bodyBattery', { provider: 'garmin', count: samples.length })
      }
      break
    }
    case 'userMetrics': {
      const dateKey = item.calendarDate || toDateKey()
      upsertUserMetric(userId, dateKey, 'garmin', { vo2max: item.vo2Max ?? null, fitnessAge: item.fitnessAge ?? null })
      publish(userId, 'metrics', { provider: 'garmin', dateKey })
      break
    }
    case 'bodyComps': {
      const ts = item.measurementTimeInSeconds ? new Date(item.measurementTimeInSeconds * 1000).toISOString() : new Date().toISOString()
      addBodyComp(userId, {
        ts,
        weightKg: item.weightInGrams ? item.weightInGrams / 1000 : null,
        bmi: item.bodyMassIndex ?? null,
        bodyFatPct: item.bodyFatInPercent ?? null,
        muscleKg: item.muscleMassInGrams ? item.muscleMassInGrams / 1000 : null,
        source: 'garmin',
      })
      publish(userId, 'weight', { provider: 'garmin' })
      break
    }
    default:
      saveRaw('garmin', `unhandled_${kind}`, item)
      log.debug(`stored unhandled push kind=${kind}`)
  }
}
