import { db } from '../db/index.js'
import {
  getDaily, getHrSamples, latestHr, getBodyBattery, latestBodyBattery, getSleep,
  getUserMetrics, latestUserMetric, listActivities, listBodyComp, latestWeight, firstWeight, weightBefore,
} from '../db/repo/fitness.js'
import { nutritionTotals, nutritionByDay, nutritionBySlot, hydrationByDay, hydrationTotal, SLOTS } from '../db/repo/nutrition.js'
import { getSettings, listGoals, goalStreak, goalDoneOn } from '../db/repo/users.js'
import { rangeFor, eachDay, toDateKey, addDays, minutesToHm, paceLabel, secondsToClock, startOfDay, endOfDay } from '../lib/time.js'

const round1 = (v) => Math.round(v * 10) / 10
const pct = (v, goal) => (goal > 0 ? Math.round((v / goal) * 100) : 0)
const trendPct = (cur, prev) => {
  if (!prev) return null
  return round1(((cur - prev) / prev) * 100)
}

const sum = (rows, col) => rows.reduce((t, r) => t + (r[col] || 0), 0)
const avg = (vals) => {
  const xs = vals.filter((v) => Number.isFinite(v))
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
}

const hourLabel = (h) => (h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`)

/**
 * Bucket time-stamped samples from the last 24 h into calendar hours, in
 * chronological order (yesterday 4p … today 3p). fields maps output key →
 * sample key; each hour averages its samples.
 */
function last24hSeries(samples, fields) {
  const buckets = new Map() // 'YYYY-MM-DD-H' → { label, sums }
  for (const smp of samples) {
    const d = new Date(smp.ts)
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`
    if (!buckets.has(key)) buckets.set(key, { label: hourLabel(d.getHours()), vals: {} })
    const b = buckets.get(key)
    for (const [out, src] of Object.entries(fields)) {
      const v = smp[src]
      if (!Number.isFinite(v)) continue
      if (!b.vals[out]) b.vals[out] = []
      b.vals[out].push(v)
    }
  }
  return [...buckets.values()].map(({ label, vals }) => {
    const row = { label }
    for (const out of Object.keys(fields)) {
      row[out] = vals[out]?.length ? Math.round(avg(vals[out])) : null
    }
    return row
  })
}

function bucketLabels(period, from, to) {
  const days = eachDay(from, to)
  if (period === 'today') return null // hourly, handled separately
  if (period === 'week') return days.map((d) => ({ key: d, label: new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' }) }))
  if (period === 'month') {
    return days.map((d) => ({ key: d, label: `W${Math.ceil(Number(d.slice(8, 10)) / 7)}` }))
  }
  return days.map((d) => ({ key: d, label: new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'short' }) }))
}

function groupSeries(entries, labels) {
  // entries: [{key(dateKey), value}] → collapse consecutive same-label buckets (weeks/months)
  const out = []
  for (const { key, label } of labels) {
    const vals = entries.filter((e) => e.key === key).map((e) => e.value).filter(Number.isFinite)
    const last = out[out.length - 1]
    if (last && last.label === label) {
      last.values.push(...vals)
    } else {
      out.push({ label, values: vals })
    }
  }
  return out
}

/** GET /api/summary?period=today|week|month|year — mirrors mockData.fitnessData[period]. */
export function buildSummary(userId, period = 'today') {
  const settings = getSettings(userId)
  const today = toDateKey()
  const { from, to, prevFrom, prevTo } = rangeFor(period, today)
  const dayCount = eachDay(from, to).length

  const daily = getDaily(userId, from, to)
  const prevDaily = getDaily(userId, prevFrom, prevTo)
  const acts = listActivities(userId, { from, to, limit: 1000 })
  const prevActs = listActivities(userId, { from: prevFrom, to: prevTo, limit: 1000 })
  const food = nutritionTotals(userId, from, to)
  const prevFood = nutritionTotals(userId, prevFrom, prevTo)

  // calories burned: active calories from wellness + activity calories not already counted
  const burnedWellness = sum(daily, 'calories_active')
  const burnedActs = sum(acts, 'calories')
  const burned = Math.round(Math.max(burnedWellness, burnedActs))
  const prevBurned = Math.round(Math.max(sum(prevDaily, 'calories_active'), sum(prevActs, 'calories')))

  const distanceKm = round1((sum(daily, 'distance_m') || sum(acts, 'distance_m')) / 1000)
  const prevDistanceKm = round1((sum(prevDaily, 'distance_m') || sum(prevActs, 'distance_m')) / 1000)
  const activeMin = Math.round(sum(acts, 'moving_s') / 60)

  const weightNow = latestWeight(userId)
  const weightPrev = weightBefore(userId, from)

  const calorieGoal = settings.calorieGoal * dayCount
  const burnGoal = (settings.burnGoal || 700) * dayCount
  const eaten = Math.round(food?.kcal || 0)

  const stats = {
    caloriesTaken: {
      value: eaten,
      goal: calorieGoal,
      trend: fmtTrend(trendPct(eaten, Math.round(prevFood?.kcal || 0)), '%'),
      up: eaten >= Math.round(prevFood?.kcal || 0),
      good: eaten <= calorieGoal,
      note: `${pct(eaten, calorieGoal)}% of ${calorieGoal.toLocaleString()} kcal goal`,
    },
    caloriesBurned: {
      value: burned,
      goal: burnGoal,
      trend: fmtTrend(trendPct(burned, prevBurned), '%'),
      up: burned >= prevBurned,
      good: true,
      note: `${pct(burned, burnGoal)}% of ${burnGoal.toLocaleString()} kcal goal`,
    },
    weight: {
      value: weightNow ? round1(weightNow.weight_kg) : null,
      unit: 'kg',
      trend: weightNow && weightPrev ? fmtSigned(round1(weightNow.weight_kg - weightPrev.weight_kg)) : null,
      up: weightNow && weightPrev ? weightNow.weight_kg > weightPrev.weight_kg : false,
      good: weightNow && weightPrev ? weightNow.weight_kg <= weightPrev.weight_kg : true,
      note: period === 'today' ? 'latest measurement' : `since last ${period}`,
    },
    distanceKm: {
      value: distanceKm,
      unit: 'km',
      trend: fmtTrend(prevDistanceKm ? round1(distanceKm - prevDistanceKm) : null, ''),
      up: distanceKm >= prevDistanceKm,
      good: true,
      note: period === 'today' ? `${activeMin} min active` : `${acts.length} activities logged`,
    },
  }

  return {
    period,
    periodLabel: { today: 'today', week: 'this week', month: 'this month', year: 'this year' }[period],
    range: { from, to },
    stats,
    // HR, sleep, VO2max and body battery are "current state" cards — they
    // always reflect today / the last 24 h, regardless of the period filter.
    heartRate: heartRateSeries(userId, 'today', today, today, daily),
    hrSummary: hrSummary(userId, getDaily(userId, today, today)),
    calorieIntake: intakeSeries(userId, period, from, to),
    intakeTotal: eaten,
    sleep: sleepSummary(userId, 'today', today, today),
    vo2max: vo2Summary(userId, settings, addDays(today, -365), today),
    bodyBattery: bodyBatterySummary(userId, 'today', today, today, getDaily(userId, today, today)),
  }
}

const fmtTrend = (v, suffix) => (v === null || v === undefined ? null : `${v >= 0 ? '+' : ''}${v}${suffix}`)
const fmtSigned = (v) => `${v >= 0 ? '+' : ''}${v}`

function heartRateSeries(userId, period, from, to, daily) {
  if (period === 'today') {
    // Rolling last 24 h so the chart is continuous even early in the day.
    const now = new Date()
    const from24 = new Date(now.getTime() - 24 * 3600_000)
    const samples = getHrSamples(userId, from24.toISOString(), now.toISOString())
    return last24hSeries(samples, { bpm: 'bpm' }).filter((r) => r.bpm !== null)
  }
  const labels = bucketLabels(period, from, to)
  const entries = daily.map((d) => ({ key: d.date_key, value: d.avg_hr ?? d.resting_hr }))
  return groupSeries(entries, labels)
    .map(({ label, values }) => ({ label, bpm: values.length ? Math.round(avg(values)) : null }))
    .filter((p) => p.bpm !== null)
}

function hrSummary(userId, daily) {
  const latest = latestHr(userId)
  let resting = avg(daily.map((d) => d.resting_hr))
  let max = Math.max(0, ...daily.map((d) => d.max_hr || 0))
  if (!resting || !max) {
    // early in the day today's row is empty — borrow yesterday's
    const today = toDateKey()
    const recent = getDaily(userId, addDays(today, -1), today)
    if (!resting) resting = avg(recent.map((d) => d.resting_hr))
    if (!max) max = Math.max(0, ...recent.map((d) => d.max_hr || 0))
  }
  const current = latest?.bpm ?? null
  let zone = 'No data'
  if (current !== null && resting) {
    zone = current < resting + 15 ? 'Resting' : current < resting + 50 ? 'Active' : 'Peak'
  }
  return {
    current,
    lastSeen: latest?.ts ?? null,
    resting: resting ? Math.round(resting) : null,
    max: max || null,
    zone,
  }
}

function intakeSeries(userId, period, from, to) {
  if (period === 'today') {
    const rows = nutritionBySlot(userId, from)
    return SLOTS.map((s) => ({ label: s.name, kcal: Math.round(rows.find((r) => r.slot === s.id)?.kcal || 0) }))
  }
  const rows = nutritionByDay(userId, from, to)
  const labels = bucketLabels(period, from, to)
  const entries = rows.map((r) => ({ key: r.date_key, value: r.kcal }))
  return groupSeries(entries, labels).map(({ label, values }) => ({
    label,
    kcal: Math.round(values.reduce((a, b) => a + b, 0)),
  }))
}

function sleepSummary(userId, period, from, to) {
  let rows = getSleep(userId, from, to)
  if (!rows.length && period === 'today') {
    // last night's sleep is often keyed to yesterday — show the latest night
    rows = getSleep(userId, addDays(from, -2), to).slice(-1)
  }
  if (!rows.length) return null
  const latest = rows[rows.length - 1]
  const pick = (col) => (period === 'today' ? latest[col] : avg(rows.map((r) => r[col])))
  const totalMin = Math.round(pick('total_min') || 0)
  if (!totalMin) return null
  const deepMin = Math.round(pick('deep_min') || 0)
  const remMin = Math.round(pick('rem_min') || 0)
  const awakeMin = Math.round(pick('awake_min') || 0)
  const fmtT = (ts) => (ts ? new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—')
  return {
    duration: minutesToHm(totalMin),
    totalMin,
    quality: Math.round(pick('score') || 0) || null,
    deep: minutesToHm(deepMin),
    deepMin,
    rem: minutesToHm(remMin),
    remMin,
    awake: `${awakeMin}m`,
    awakeMin,
    lightMin: Math.round(pick('light_min') || 0),
    window: period === 'today' ? `${fmtT(latest.start_ts)} – ${fmtT(latest.end_ts)}` : `avg over ${rows.length} nights`,
    trend: null,
    good: totalMin >= 420,
  }
}

function vo2Summary(userId, settings, from, to) {
  const inRange = getUserMetrics(userId, from, to).filter((m) => m.vo2max)
  const latest = inRange[inRange.length - 1] || latestUserMetric(userId)
  if (!latest?.vo2max) return null
  const v = Math.round(latest.vo2max) // Garmin's watch/app show the rounded value
  const rating = v >= 50 ? 'Superior' : v >= 45 ? 'Excellent' : v >= 40 ? 'Good' : v >= 35 ? 'Fair' : 'Needs work'
  const dailyNow = getDaily(userId, from, to)
  return {
    value: round1(v),
    unit: 'ml/kg/min',
    goal: 52,
    rating,
    restingHr: Math.round(avg(dailyNow.map((d) => d.resting_hr)) || 0) || null,
    fitnessAge: latest.fitness_age ? Math.round(latest.fitness_age) : null,
    trend: null,
    good: true,
  }
}

function bodyBatterySummary(userId, period, from, to, daily) {
  const latest = latestBodyBattery(userId)
  let high = Math.max(0, ...daily.map((d) => d.bb_high || 0)) || null
  const lows = daily.map((d) => d.bb_low).filter(Number.isFinite)
  let low = lows.length ? Math.min(...lows) : null
  const charged = sum(daily, 'bb_charged') || null
  const drained = sum(daily, 'bb_drained') || null
  let derivedCharged = null
  let derivedDrained = null
  const level = latest?.level ?? null

  let series
  if (period === 'today') {
    // Rolling last 24 h, matching the heart-rate chart.
    const now = new Date()
    const from24 = new Date(now.getTime() - 24 * 3600_000)
    const samples = getBodyBattery(userId, from24.toISOString(), now.toISOString())
    series = last24hSeries(samples, { battery: 'level', stress: 'stress' })
      .filter((r) => r.battery !== null || r.stress !== null)
    const levels = samples.map((x) => x.level).filter(Number.isFinite)
    if (levels.length) {
      if (high === null) high = Math.max(...levels)
      if (low === null) low = Math.min(...levels)
    }
    if (charged === null && levels.length > 1) {
      let up = 0
      let down = 0
      for (let i = 1; i < levels.length; i++) {
        const diff = levels[i] - levels[i - 1]
        if (diff > 0) up += diff
        else down -= diff
      }
      derivedCharged = up || null
      derivedDrained = down || null
    }
    if (level === null && high === null && !series.length) return null
  } else {
    if (level === null && high === null) return null
    const labels = bucketLabels(period, from, to)
    const bat = groupSeries(daily.map((d) => ({ key: d.date_key, value: d.bb_high })), labels)
    const str = groupSeries(daily.map((d) => ({ key: d.date_key, value: d.stress_avg })), labels)
    series = bat.map(({ label, values }, i) => ({
      label,
      battery: values.length ? Math.round(avg(values)) : null,
      stress: str[i]?.values.length ? Math.round(avg(str[i].values)) : null,
    }))
  }

  return {
    level,
    status: level === null ? '—' : level >= 70 ? 'Energized' : level >= 40 ? 'Balanced' : 'Strained',
    charged: (charged ?? derivedCharged) ? fmtSigned(charged ?? derivedCharged) : null,
    drained: (drained ?? derivedDrained) ? fmtSigned(-Math.abs(drained ?? derivedDrained)) : null,
    low,
    high,
    trend: null,
    good: (level ?? 0) >= 40,
    series,
  }
}

// ── workouts page ─────────────────────────────────────────────────────────────
export function buildWorkouts(userId) {
  const settings = getSettings(userId)
  const today = toDateKey()
  const weekStart = rangeFor('week', today).from
  const acts = listActivities(userId, { limit: 500 })
  const runs = acts.filter((a) => a.sport === 'run')

  const workoutRows = acts.slice(0, 50).map((a) => ({
    id: a.id,
    date: new Date(`${a.date_key}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    dateKey: a.date_key,
    type: a.name,
    sport: a.sport,
    provider: a.provider,
    distance: round1(a.distance_m / 1000),
    duration: secondsToClock(a.moving_s || a.duration_s),
    pace: a.avg_pace_s_km ? `${paceLabel(a.avg_pace_s_km)} /km` : '—',
    calories: a.calories,
    hr: a.avg_hr,
  }))

  // weekly distance, last 8 weeks
  const weeklyDistance = []
  for (let i = 7; i >= 0; i--) {
    const ws = addDays(weekStart, -7 * i)
    const we = addDays(ws, 6)
    const km = round1(sum(acts.filter((a) => a.date_key >= ws && a.date_key <= we), 'distance_m') / 1000)
    weeklyDistance.push({ label: new Date(`${ws}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), km })
  }

  // One point per run (not per week) — same-week runs each keep their own point.
  const paceTrend = runs
    .filter((a) => a.avg_pace_s_km)
    .slice(0, 20)
    .reverse() // runs list is newest-first; the chart reads left-to-right in time
    .map((a) => ({
      label: new Date(`${a.date_key}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      pace: round1(a.avg_pace_s_km / 60),
    }))

  const thisWeek = acts.filter((a) => a.date_key >= weekStart)
  const ranDays = new Set(runs.filter((a) => a.date_key >= weekStart).map((a) => a.date_key))
  const weekDays = eachDay(weekStart, addDays(weekStart, 6)).map((d) => ({
    day: new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { weekday: 'narrow' }),
    ran: ranDays.has(d),
  }))

  // streak: consecutive weeks (ending this week) with ≥1 run
  let streakWeeks = 0
  for (let i = 0; i < 260; i++) {
    const ws = addDays(weekStart, -7 * i)
    const we = addDays(ws, 6)
    const has = runs.some((a) => a.date_key >= ws && a.date_key <= we)
    if (!has) break
    streakWeeks += 1
  }

  const prs = buildPRs(runs)

  return {
    workouts: workoutRows,
    weeklyDistance,
    paceTrend,
    personalRecords: prs,
    runningStats: {
      streakWeeks,
      longestStreakWeeks: streakWeeks, // full history scan omitted; equal is honest for now
      thisWeekKm: round1(sum(thisWeek, 'distance_m') / 1000),
      weeklyGoalKm: settings.weeklyDistanceGoal,
      totalKm: round1(sum(acts, 'distance_m') / 1000),
      totalRuns: runs.length,
      avgPace: paceLabel(avg(runs.map((a) => a.avg_pace_s_km))),
      weekDays,
    },
  }
}

function buildPRs(runs) {
  const prs = []
  const fmtDate = (dk) => new Date(`${dk}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const fiveKs = runs.filter((a) => a.distance_m >= 4900)
  if (fiveKs.length) {
    const best = fiveKs.reduce((b, a) => {
      const t = (a.moving_s || a.duration_s) * (5000 / a.distance_m)
      return !b || t < b.t ? { t, a } : b
    }, null)
    prs.push({ label: 'Fastest 5K', value: secondsToClock(best.t), date: fmtDate(best.a.date_key) })
  }
  if (runs.length) {
    const longest = runs.reduce((b, a) => (a.distance_m > b.distance_m ? a : b))
    prs.push({ label: 'Longest Run', value: `${round1(longest.distance_m / 1000)} km`, date: fmtDate(longest.date_key) })
  }
  return prs
}

// ── progress page ─────────────────────────────────────────────────────────────
export function buildProgress(userId) {
  const settings = getSettings(userId)
  const today = toDateKey()
  const weights = listBodyComp(userId, { from: addDays(today, -365) })
  const first = firstWeight(userId)
  const current = latestWeight(userId)

  // One point per day (last measurement of the day wins); monthly grouping hid
  // multiple entries logged in the same month.
  const byDay = new Map()
  for (const w of weights) {
    byDay.set(w.date_key, w.weight_kg)
  }
  const weightSeries = [...byDay.entries()].slice(-30).map(([day, kg]) => ({
    label: new Date(`${day}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    kg: round1(kg),
  }))

  const week = rangeFor('week', today)
  const hydrationWeek = hydrationByDay(userId, week.from, addDays(week.from, 6))
  const hydration = {
    todayMl: hydrationTotal(userId, today),
    goalMl: settings.waterGoalMl,
    glassMl: 250,
    week: eachDay(week.from, addDays(week.from, 6)).map((d) => ({
      label: new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' }),
      ml: hydrationWeek.find((h) => h.date_key === d)?.ml || 0,
    })),
  }

  const goals = listGoals(userId).map((g) => {
    const auto = autoGoalEvaluator(g.label)
    if (!auto) {
      return { id: g.id, label: g.label, auto: false, streak: goalStreak(g.id), doneToday: goalDoneOn(g.id, today) }
    }
    const { done, detail } = auto.check(userId, settings, today)
    return { id: g.id, label: g.label, auto: true, doneToday: done, detail, streak: autoStreak(auto, userId, settings, today, done) }
  })

  // sleep debt: shortfall vs an 8 h target across the last 7 recorded nights
  const nights = getSleep(userId, addDays(today, -7), today)
  const TARGET_MIN = 480
  const sleepDebt = nights.length
    ? {
        hours: round1(nights.reduce((acc, n) => acc + Math.max(0, TARGET_MIN - (n.total_min || 0)), 0) / 60),
        avgHours: round1(nights.reduce((a, n) => a + (n.total_min || 0), 0) / nights.length / 60),
        nights: nights.length,
        targetHours: 8,
      }
    : null

  const quitDate = settings.quitDate
  const smokeFree = quitDate
    ? {
        quitDate: new Date(`${quitDate}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        daysSmokeFree: Math.max(0, Math.floor((startOfDay(today) - startOfDay(quitDate)) / 86_400_000)),
        cigarettesPerDay: settings.cigarettesPerDay,
        costPerCigarette: settings.costPerCigarette,
      }
    : null

  return {
    weightSeries,
    progressStats: {
      startWeight: settings.startWeight ?? (first ? round1(first.weight_kg) : null),
      currentWeight: current ? round1(current.weight_kg) : null,
      goalWeight: settings.goalWeight,
      heightCm: settings.heightCm,
    },
    hydration,
    dailyGoals: goals,
    sleepDebt,
    smokeFree,
  }
}

// ── auto-evaluated daily goals ────────────────────────────────────────────────
const SWEET_DRINK_RE = /juice|soda|cola|coke|pepsi|sprite|fanta|milo|boba|bubble tea|iced tea|sweet tea|teh tarik|sirap|syrup|100 ?plus|yakult|lassi|milkshake|shake|smoothie|frapp|mocha|latte|soft ?drink|energy drink|drink/i

function sweetDrinkHits(userId, dateKey) {
  return db.prepare(`
    SELECT fi.name, fi.sugar FROM food_items fi
    JOIN meals m ON m.id = fi.meal_id
    WHERE fi.user_id = ? AND m.date_key = ?
  `).all(userId, dateKey).filter((i) => SWEET_DRINK_RE.test(i.name || '') && (i.sugar ?? 0) >= 5)
}

const GOAL_EVALUATORS = [
  {
    match: /sweet|sugar/i,
    check(userId, settings, dateKey) {
      const hits = sweetDrinkHits(userId, dateKey)
      return {
        done: hits.length === 0,
        detail: hits.length ? `logged: ${hits[0].name}` : 'no sweet drinks logged',
      }
    },
  },
  {
    match: /water|hydrat/i,
    check(userId, settings, dateKey) {
      const ml = hydrationTotal(userId, dateKey)
      return { done: ml >= settings.waterGoalMl, detail: `${round1(ml / 1000)} / ${round1(settings.waterGoalMl / 1000)} L` }
    },
  },
  {
    match: /step/i,
    check(userId, settings, dateKey) {
      const steps = getDaily(userId, dateKey, dateKey)[0]?.steps ?? 0
      return { done: steps >= 10_000, detail: `${steps.toLocaleString()} / 10,000 steps` }
    },
  },
  {
    match: /sleep/i,
    check(userId, settings, dateKey) {
      const night = getSleep(userId, dateKey, dateKey)[0]
      if (!night?.start_ts) return { done: false, detail: 'no sleep data yet' }
      const h = new Date(night.start_ts).getHours()
      const inBed = new Date(night.start_ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      return { done: h >= 17 && h < 23, detail: `in bed ${inBed}` }
    },
  },
]

// "No smoking" (and anything unmatched) stays a manual tap
const autoGoalEvaluator = (label) =>
  /smok/i.test(label) ? null : GOAL_EVALUATORS.find((e) => e.match.test(label)) ?? null

function autoStreak(evaluator, userId, settings, today, doneToday) {
  // never count days before the account existed (empty days often auto-pass)
  const created = db.prepare('SELECT created_at FROM users WHERE id = ?').get(userId)?.created_at
  const floor = created ? created.slice(0, 10) : today
  let streak = doneToday ? 1 : 0
  const cursor = new Date(`${today}T00:00:00`)
  for (let i = 0; i < 120; i++) {
    cursor.setDate(cursor.getDate() - 1)
    const key = toDateKey(cursor)
    if (key < floor) break
    if (!evaluator.check(userId, settings, key).done) break
    streak += 1
  }
  return streak
}

// ── nutrition page ────────────────────────────────────────────────────────────
export function buildNutritionDay(userId, dateKey, listMealsFn) {
  const settings = getSettings(userId)
  const totals = nutritionTotals(userId, dateKey, dateKey)
  return {
    date: new Date(`${dateKey}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
    dateKey,
    calorieGoal: settings.calorieGoal,
    totals: {
      kcal: Math.round(totals.kcal), protein: Math.round(totals.protein), carbs: Math.round(totals.carbs),
      fat: Math.round(totals.fat), fiber: Math.round(totals.fiber), sugar: Math.round(totals.sugar),
    },
    macros: {
      protein: { value: Math.round(totals.protein), goal: settings.proteinGoal, unit: 'g' },
      carbs: { value: Math.round(totals.carbs), goal: settings.carbsGoal, unit: 'g' },
      fat: { value: Math.round(totals.fat), goal: settings.fatGoal, unit: 'g' },
      water: { value: round1(hydrationTotal(userId, dateKey) / 1000), goal: round1(settings.waterGoalMl / 1000), unit: 'L' },
    },
    meals: listMealsFn(userId, dateKey),
  }
}
