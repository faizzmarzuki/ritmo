import { Router } from 'express'
import { config } from '../config.js'
import { requireAuth } from '../auth/middleware.js'
import { visionKeyFor } from '../services/apiKeys.js'
import { buildSummary, buildProgress } from '../services/summary.js'
import { listMeals } from '../db/repo/nutrition.js'
import { listFoodMemory } from '../db/repo/foodMemory.js'
import { all } from '../db/index.js'
import { toDateKey } from '../lib/time.js'
import { logger } from '../lib/log.js'

const log = logger('chat')
const router = Router()
router.use(requireAuth)

/**
 * Compact snapshot of the user's data for the coach. Deliberately terse —
 * short keys, rounded numbers — to keep prompt tokens low.
 */
function coreContext(userId) {
  const t = buildSummary(userId, 'today')
  const w = buildSummary(userId, 'week')
  const p = buildProgress(userId)
  const meals = listMeals(userId, toDateKey()).map((m) => ({
    slot: m.slot,
    name: m.name,
    kcal: Math.round(m.items?.reduce((a, i) => a + (i.kcal || 0), 0) ?? 0),
  }))
  return {
    today: {
      kcalIn: t.stats?.caloriesTaken?.value ?? 0,
      kcalGoal: t.stats?.caloriesTaken?.goal ?? null,
      kcalBurned: t.stats?.caloriesBurned?.value ?? 0,
      meals,
    },
    week: { kcalIn: w.stats?.caloriesTaken?.value, distanceKm: w.stats?.distance?.value ?? w.stats?.distanceKm?.value },
    heart: t.hrSummary ? { current: t.hrSummary.current, resting: t.hrSummary.resting, max: t.hrSummary.max } : null,
    sleep: t.sleep ? { last: t.sleep.duration, quality: t.sleep.quality, debtH: p.sleepDebt?.hours, avgH: p.sleepDebt?.avgHours } : null,
    bodyBattery: t.bodyBattery ? { level: t.bodyBattery.level, status: t.bodyBattery.status } : null,
    vo2max: t.vo2max ? { current: t.vo2max.value, rating: t.vo2max.rating } : null,
    weight: p.progressStats ? { current: p.progressStats.currentWeight, goal: p.progressStats.goalWeight } : null,
    hydration: { todayL: (p.hydration?.todayMl ?? 0) / 1000, goalL: (p.hydration?.goalMl ?? 0) / 1000 },
    goals: p.dailyGoals?.map((g) => ({ g: g.label, done: g.doneToday, streak: g.streak, note: g.detail })),
    smokeFree: p.smokeFree ? { days: p.smokeFree.daysSmokeFree } : null,
  }
}

/**
 * Topic-routed "research": each matched topic pulls extra history from the DB
 * and contributes a visible thinking step. One model call at the end — the
 * research is cheap SQL, not extra LLM calls.
 */
const TOPICS = [
  {
    match: /vo2|vo₂|fitness (level|age)|cardio|stamina/i,
    step: 'Analyzing your VO₂max history',
    data: (userId) => ({
      vo2History: all(
        'SELECT date_key d, ROUND(vo2max,1) v FROM user_metrics WHERE user_id = ? AND vo2max IS NOT NULL ORDER BY date_key DESC LIMIT 14',
        userId,
      ),
    }),
  },
  {
    match: /run|pace|workout|train|jog|exercise|larian?|latihan/i,
    step: 'Reviewing your recent workouts',
    data: (userId) => ({
      workouts: all(
        `SELECT date_key d, name, ROUND(distance_m/1000.0,2) km, ROUND(duration_s/60) min, avg_hr, calories
         FROM activities WHERE user_id = ? ORDER BY date_key DESC LIMIT 5`,
        userId,
      ),
    }),
  },
  {
    match: /eat|food|meal|calorie|kcal|diet|macro|protein|makan|lapar|hungry/i,
    step: 'Checking your calorie budget and food history',
    data: (userId) => ({
      knownFoods: listFoodMemory(userId, 10).map((f) => ({ name: f.display_name, kcal: Math.round(f.kcal || 0) })),
    }),
  },
  {
    match: /sleep|tidur|rest|recovery|insomnia/i,
    step: 'Reviewing your recent sleep',
    data: (userId) => ({
      sleepHistory: all(
        `SELECT date_key d, ROUND(total_min/6.0)/10 h, score FROM sleep_records
         WHERE user_id = ? ORDER BY date_key DESC LIMIT 7`,
        userId,
      ),
    }),
  },
]

const SYSTEM = `You are the user's personal trainer and nutrition coach inside Ritmo, a fitness app. You receive a JSON snapshot (DATA) of their real Garmin and food-log data: activities, heart rate, VO₂max, sleep, body battery, calories, hydration, goals, smoke-free streak, and topic-specific history when relevant.

Rules:
- ALWAYS answer questions about the user's own data and trends. Interpret the numbers and explain the most likely causes (training load, sleep debt, stress, dehydration, detraining, normal fluctuation for a new runner) — never say you cannot access or generate this; the data is right there in DATA.
- Be a coach, not a dashboard: give a concrete next action (a workout to do, what to eat, a bedtime target), not just a description of the numbers.
- The user is in Malaysia. For meal advice, suggest local options (and prefer foods from knownFoods with their kcal) that fit the remaining calorie budget (kcalGoal - kcalIn).
- Cite their actual numbers. If something is missing from DATA, say what's missing in a few words but still give best-effort advice.
- Only health, fitness, nutrition, sleep and recovery. Anything else: one sentence saying you only coach their health.
- Under 150 words. Plain text, no markdown headers.
- You are not a doctor — for symptoms or medical concerns, add one short line advising a professional.`

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

router.post('/chat', async (req, res) => {
  const apiKey = visionKeyFor(req.user.id)
  if (!apiKey) return res.status(503).json({ error: 'Chat needs an OpenAI API key — add yours in Settings → Integrations.' })
  const history = Array.isArray(req.body?.messages) ? req.body.messages : []
  // token efficiency: last 8 turns, each capped at 800 chars
  const trimmed = history.slice(-8).map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content || '').slice(0, 800),
  }))
  if (!trimmed.length) return res.status(400).json({ error: 'messages required' })

  // NDJSON stream: step events while researching, then the reply.
  res.setHeader('Content-Type', 'application/x-ndjson')
  res.setHeader('Cache-Control', 'no-cache')
  const emit = (obj) => res.write(`${JSON.stringify(obj)}\n`)

  try {
    const t0 = Date.now()
    emit({ type: 'step', label: 'Reading your Garmin snapshot' })
    const ctx = coreContext(req.user.id)

    const question = trimmed.filter((m) => m.role === 'user').at(-1)?.content ?? ''
    for (const topic of TOPICS) {
      if (!topic.match.test(question)) continue
      await sleep(300) // let each research step register visually
      emit({ type: 'step', label: topic.step })
      Object.assign(ctx, topic.data(req.user.id))
    }

    await sleep(300)
    emit({ type: 'step', label: 'Writing your plan' })

    const resp = await fetch(`${config.vision.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: config.chat.model,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'system', content: `DATA ${JSON.stringify(ctx)}` },
          ...trimmed,
        ],
        max_tokens: 400,
        temperature: 0.4,
      }),
    })
    const data = await resp.json()
    if (!resp.ok) throw new Error(data.error?.message || `HTTP ${resp.status}`)
    const reply = data.choices?.[0]?.message?.content?.trim()
    if (!reply) throw new Error('empty reply from model')
    log.info(`reply in ${Date.now() - t0}ms, tokens in/out: ${data.usage?.prompt_tokens}/${data.usage?.completion_tokens}`)
    emit({
      type: 'reply',
      text: reply,
      ms: Date.now() - t0,
      usage: data.usage ? { in: data.usage.prompt_tokens, out: data.usage.completion_tokens } : null,
    })
  } catch (err) {
    log.error(`chat failed: ${err.message}`)
    emit({ type: 'error', error: err.message })
  } finally {
    res.end()
  }
})

export default router
