import { toDateKey } from '../../lib/time.js'

const SPORT_MAP = {
  RUNNING: 'run', TRAIL_RUNNING: 'run', TREADMILL_RUNNING: 'run', INDOOR_RUNNING: 'run', TRACK_RUNNING: 'run',
  CYCLING: 'ride', INDOOR_CYCLING: 'ride', MOUNTAIN_BIKING: 'ride', ROAD_BIKING: 'ride', GRAVEL_CYCLING: 'ride', VIRTUAL_RIDE: 'ride',
  LAP_SWIMMING: 'swim', OPEN_WATER_SWIMMING: 'swim', SWIMMING: 'swim',
  WALKING: 'walk', HIKING: 'walk', CASUAL_WALKING: 'walk',
  STRENGTH_TRAINING: 'strength', HIIT: 'strength', CARDIO: 'strength', FITNESS_EQUIPMENT: 'strength',
}

const iso = (unixSeconds) => new Date(unixSeconds * 1000).toISOString()

/** Garmin Health API activity summary → activities row. */
export function normalizeActivity(a) {
  const startUnix = a.startTimeInSeconds
  const offset = a.startTimeOffsetInSeconds || 0
  const startLocal = new Date((startUnix + offset) * 1000).toISOString().replace('Z', '')
  const typeKey = String(a.activityType || '').toUpperCase()
  const distanceM = a.distanceInMeters || 0
  const durationS = a.durationInSeconds || 0
  const avgSpeedMs = a.averageSpeedInMetersPerSecond || (durationS > 0 ? distanceM / durationS : null)

  return {
    provider: 'garmin',
    externalId: a.summaryId || a.activityId,
    name: a.activityName || a.activityType || 'Activity',
    sport: SPORT_MAP[typeKey] || 'other',
    sportRaw: a.activityType || null,
    startTime: iso(startUnix),
    startLocal,
    dateKey: startLocal.slice(0, 10),
    timezone: offset ? `UTC${offset >= 0 ? '+' : ''}${offset / 3600}` : null,
    durationS,
    movingS: a.movingDurationInSeconds ?? durationS,
    distanceM,
    elevationM: a.totalElevationGainInMeters || 0,
    calories: a.activeKilocalories || 0,
    avgHr: a.averageHeartRateInBeatsPerMinute ?? null,
    maxHr: a.maxHeartRateInBeatsPerMinute ?? null,
    avgSpeedMs,
    avgPaceSKm: avgSpeedMs > 0 ? 1000 / avgSpeedMs : null,
    steps: a.steps ?? null,
  }
}

/** Garmin "dailies" summary → daily_metrics + body battery + hr samples. */
export function normalizeDaily(d) {
  const dateKey = d.calendarDate || toDateKey(iso(d.startTimeInSeconds))
  const daily = {
    steps: d.steps ?? null,
    distance_m: d.distanceInMeters ?? null,
    floors: d.floorsClimbed ?? null,
    calories_active: d.activeKilocalories ?? null,
    calories_bmr: d.bmrKilocalories ?? null,
    resting_hr: d.restingHeartRateInBeatsPerMinute ?? null,
    min_hr: d.minHeartRateInBeatsPerMinute ?? null,
    max_hr: d.maxHeartRateInBeatsPerMinute ?? null,
    avg_hr: d.averageHeartRateInBeatsPerMinute ?? null,
    stress_avg: d.averageStressLevel ?? null,
    stress_max: d.maxStressLevel ?? null,
    bb_high: d.bodyBatteryHighestValue ?? null,
    bb_low: d.bodyBatteryLowestValue ?? null,
    bb_charged: d.bodyBatteryChargedValue ?? null,
    bb_drained: d.bodyBatteryDrainedValue ?? null,
    intensity_minutes: (d.moderateIntensityDurationInSeconds || 0) / 60 + ((d.vigorousIntensityDurationInSeconds || 0) / 60) * 2 || null,
  }

  // timeOffsetHeartRateSamples: { "<secondsFromStart>": bpm }
  const hrSamples = []
  if (d.timeOffsetHeartRateSamples && d.startTimeInSeconds) {
    for (const [offset, bpm] of Object.entries(d.timeOffsetHeartRateSamples)) {
      if (Number.isFinite(bpm)) hrSamples.push({ ts: iso(d.startTimeInSeconds + Number(offset)), bpm })
    }
  }
  return { dateKey, daily, hrSamples }
}

/** Garmin sleep summary → sleep_records row. */
export function normalizeSleep(s) {
  const dateKey = s.calendarDate || toDateKey(iso(s.startTimeInSeconds))
  return {
    dateKey,
    sleep: {
      startTs: s.startTimeInSeconds ? iso(s.startTimeInSeconds) : null,
      endTs: s.startTimeInSeconds ? iso(s.startTimeInSeconds + (s.durationInSeconds || 0)) : null,
      totalMin: s.durationInSeconds ? Math.round(s.durationInSeconds / 60) : null,
      deepMin: s.deepSleepDurationInSeconds ? Math.round(s.deepSleepDurationInSeconds / 60) : null,
      lightMin: s.lightSleepDurationInSeconds ? Math.round(s.lightSleepDurationInSeconds / 60) : null,
      remMin: s.remSleepInSeconds ? Math.round(s.remSleepInSeconds / 60) : null,
      awakeMin: s.awakeDurationInSeconds ? Math.round(s.awakeDurationInSeconds / 60) : null,
      score: s.overallSleepScore?.value ?? s.sleepScores?.overall?.value ?? null,
    },
  }
}

/** stressDetails push → body battery + stress samples. */
export function normalizeStressDetails(d) {
  const samples = []
  const start = d.startTimeInSeconds
  if (!start) return samples
  const bb = d.timeOffsetBodyBatteryValues || {}
  const stress = d.timeOffsetStressLevelValues || {}
  const offsets = new Set([...Object.keys(bb), ...Object.keys(stress)])
  for (const off of offsets) {
    const stressVal = stress[off]
    samples.push({
      ts: iso(start + Number(off)),
      level: Number.isFinite(bb[off]) ? bb[off] : null,
      stress: Number.isFinite(stressVal) && stressVal >= 0 ? stressVal : null,
    })
  }
  return samples
}
