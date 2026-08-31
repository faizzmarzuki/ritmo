import { Router } from 'express'
import { config, visionBaseUrl } from '../config.js'
import { requireAuth } from '../auth/middleware.js'
import { openaiKeyFor } from '../services/apiKeys.js'
import { buildSummary, buildProgress } from '../services/summary.js'
import { listMeals } from '../db/repo/nutrition.js'
import { listFoodMemory } from '../db/repo/foodMemory.js'
import { all } from '../db/index.js'
import {
  createConversation, getConversation, listConversations, deleteConversation,
  addChatMessage, listChatMessages, recentThread, recentMessagesAcross, findAssistantTurn,
} from '../db/repo/chat.js'
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

/**
 * Cross-conversation recall: score recent messages from the user's OTHER
 * conversations by keyword overlap with the new question, return the strongest
 * matches. Cheap JS scoring over a small personal history — no extra LLM call.
 */
const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'have', 'what', 'when', 'where', 'which', 'while',
  'how', 'should', 'could', 'would', 'about', 'your', 'you', 'are', 'was', 'were', 'from', 'will',
  'been', 'they', 'their', 'there', 'here', 'more', 'less', 'much', 'many', 'some', 'today',
  'tomorrow', 'yesterday', 'week', 'good', 'best', 'better', 'need', 'want', 'like', 'just',
  'saya', 'yang', 'untuk', 'dengan', 'boleh', 'macam', 'mana', 'nak', 'tak', 'ada', 'ini', 'itu',
])

const keywords = (text) =>
  [...new Set(String(text).toLowerCase().match(/[a-zà-ž0-9]{3,}/gi) || [])]
    .filter((w) => !STOPWORDS.has(w))
    .slice(0, 10)

function recallRelated(userId, excludeConversationId, question) {
  const words = keywords(question)
  if (!words.length) return []
  const pool = recentMessagesAcross(userId, excludeConversationId)
  const needHits = Math.min(2, words.length) // "strongly related": ≥2 keyword hits when possible
  return pool
    .map((m) => {
      const text = m.content.toLowerCase()
      return { m, hits: words.filter((w) => text.includes(w)).length }
    })
    .filter((s) => s.hits >= needHits)
    .sort((a, b) => b.hits - a.hits || (a.m.created_at < b.m.created_at ? 1 : -1))
    .slice(0, 6)
    .map(({ m }) => ({
      when: m.created_at.slice(0, 10),
      topic: m.title,
      [m.role === 'user' ? 'userSaid' : 'coachSaid']: m.content.slice(0, 300),
    }))
}

const SYSTEM = `You are the user's personal trainer and nutrition coach inside Ritmo, a fitness app. You receive a JSON snapshot (DATA) of their real Garmin and food-log data: activities, heart rate, VO₂max, sleep, body battery, calories, hydration, goals, smoke-free streak, and topic-specific history when relevant.

Rules:
- ALWAYS answer questions about the user's own data and trends. Interpret the numbers and explain the most likely causes (training load, sleep debt, stress, dehydration, detraining, normal fluctuation for a new runner) — never say you cannot access or generate this; the data is right there in DATA.
- Be a coach, not a dashboard: give a concrete next action (a workout to do, what to eat, a bedtime target), not just a description of the numbers.
- Meal advice: compute the remaining calorie budget (kcalGoal - kcalIn) and treat it as a hard cap — the goal is to hit the calorie deficit, never exceed it. State the remaining budget, suggest something that fits within it, and say roughly how much budget is left after the suggested meal. If the budget is nearly spent, say so and suggest the lightest sensible option instead.
- NEVER suggest a dish the user already logged today — check today.meals first and pick something different for variety.
- The user is in Malaysia: suggest local options. knownFoods (their logged history with kcal) is a helpful reference for portions and calories, not a menu — do not limit suggestions to it.
- Constraints the user states in their message (eating out, no time to cook, specific cuisine, budget, what the restaurant serves) override everything above except the calorie cap. If they are eating out, suggest realistic dishes to order at a typical Malaysian eatery and estimate their kcal.
- Cite their actual numbers. If something is missing from DATA, say what's missing in a few words but still give best-effort advice.
- DATA may include pastConversations — snippets from the user's earlier chats with you. Use them to stay consistent with what they told you before (injuries, preferences, plans, constraints) and reference them naturally when relevant.
- Only health, fitness, nutrition, sleep and recovery. Anything else: one sentence saying you only coach their health.
- Under 150 words. Plain text, no markdown headers.
- You are not a doctor — for symptoms or medical concerns, add one short line advising a professional.`

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// One reservation per turnId while its turn is running, so a concurrent
// duplicate (double-submit, impatient retry) is rejected instead of racing the
// replay check and persisting twice. In-process is sufficient: the app is a
// single Node process writing to one SQLite file.
const activeTurns = new Set()

// ── conversation history ─────────────────────────────────────────────────────
router.get('/chat/conversations', (req, res) => res.json(listConversations(req.user.id)))

router.get('/chat/conversations/:id', (req, res) => {
  const conv = getConversation(req.user.id, req.params.id)
  if (!conv) return res.status(404).json({ error: 'Not found' })
  const messages = listChatMessages(conv.id).map((m) => {
    let meta = null
    try { meta = m.meta ? JSON.parse(m.meta) : null } catch { /* keep null */ }
    return { id: m.id, role: m.role, content: m.content, meta, createdAt: m.created_at }
  })
  res.json({ conversation: conv, messages })
})

router.delete('/chat/conversations/:id', (req, res) => {
  const conv = getConversation(req.user.id, req.params.id)
  if (!conv) return res.status(404).json({ error: 'Not found' })
  deleteConversation(req.user.id, conv.id)
  res.json({ ok: true })
})

/**
 * POST /api/chat { message, conversationId? } — one new user turn. The server
 * owns the thread: it loads recent history from the DB, recalls strongly
 * related snippets from the user's OTHER conversations, persists both sides,
 * and streams NDJSON (step events while researching, then the reply).
 */
router.post('/chat', async (req, res) => {
  const apiKey = openaiKeyFor(req.user.id)
  if (!apiKey) return res.status(503).json({ error: 'Chat needs an OpenAI API key — add yours in Settings → Integrations.' })

  const message = String(req.body?.message || '').trim().slice(0, 2000)
  if (!message) return res.status(400).json({ error: 'message required' })

  let conv = null
  if (req.body?.conversationId) {
    // Non-string ids would make better-sqlite3 throw synchronously, outside the try below.
    if (typeof req.body.conversationId !== 'string') return res.status(400).json({ error: 'conversationId must be a string' })
    conv = getConversation(req.user.id, req.body.conversationId)
    if (!conv) return res.status(404).json({ error: 'Conversation not found' })
  }

  // Model context: last 7 stored exchanges of this thread + the new message.
  const prior = conv ? recentThread(conv.id, 7) : []
  const trimmed = [...prior, { role: 'user', content: message }].map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content || '').slice(0, 800),
  }))

  // Retried sends reuse their client-generated turnId, so a turn that was
  // persisted but whose reply never reached the client (network drop mid-stream)
  // is replayed instead of run and stored a second time.
  const turnId = typeof req.body?.turnId === 'string' ? req.body.turnId.slice(0, 64) : null
  // Reservations are per user: turnIds are client-generated, so one user's id
  // must never block (or replay into) another user's turn. findAssistantTurn is
  // already user-scoped in SQL.
  const turnKey = turnId ? `${req.user.id}:${turnId}` : null

  res.setHeader('Content-Type', 'application/x-ndjson')
  res.setHeader('Cache-Control', 'no-store')
  const emit = (obj) => res.write(`${JSON.stringify(obj)}\n`)

  let reservedTurn = false
  try {
    if (turnId) {
      const prev = findAssistantTurn(req.user.id, turnId)
      if (prev) {
        let meta = null
        try { meta = prev.meta ? JSON.parse(prev.meta) : null } catch { /* keep null */ }
        emit({ type: 'reply', text: prev.content, ms: meta?.ms ?? null, conversationId: prev.conversation_id, usage: null })
        return
      }
      if (activeTurns.has(turnKey)) {
        emit({ type: 'error', error: 'This message is already being processed — wait for it to finish.' })
        return
      }
      activeTurns.add(turnKey)
      reservedTurn = true
    }

    const t0 = Date.now()
    const steps = []
    const step = (label) => {
      steps.push(label)
      emit({ type: 'step', label })
    }
    step('Reading your Garmin snapshot')
    const ctx = coreContext(req.user.id)

    const related = recallRelated(req.user.id, conv?.id, message)
    if (related.length) {
      await sleep(300) // let each research step register visually
      step('Recalling related past conversations')
      ctx.pastConversations = related
    }

    for (const topic of TOPICS) {
      if (!topic.match.test(message)) continue
      await sleep(300)
      step(topic.step)
      Object.assign(ctx, topic.data(req.user.id))
    }

    await sleep(300)
    step('Writing your plan')

    const resp = await fetch(`${visionBaseUrl()}/chat/completions`, {
      method: 'POST',
      redirect: 'error', // never follow a redirect carrying the API key
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: config.chat.model,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'system', content: `DATA ${JSON.stringify(ctx)}` },
          ...trimmed,
        ],
        // gpt-5-family models reject custom temperature/max_tokens and spend
        // completion tokens on reasoning first — mirror foodAgent's handling.
        ...(/^(gpt-5|o\d)/.test(config.chat.model)
          ? { max_completion_tokens: 2000, reasoning_effort: 'low' }
          : { max_tokens: 400, temperature: 0.4 }),
      }),
    })
    const data = await resp.json()
    if (!resp.ok) throw new Error(data.error?.message || `HTTP ${resp.status}`)
    const reply = data.choices?.[0]?.message?.content?.trim()
    if (!reply) throw new Error('empty reply from model')

    // Persist only after a successful reply so failed sends can be retried cleanly.
    const ms = Date.now() - t0
    if (!conv) {
      const title = message.length > 60 ? `${message.slice(0, 57)}…` : message
      conv = { id: createConversation(req.user.id, title) }
    }
    addChatMessage(req.user.id, conv.id, 'user', message)
    addChatMessage(req.user.id, conv.id, 'assistant', reply, { steps, ms, ...(turnId ? { turnId } : {}) })

    log.info(`reply in ${ms}ms, tokens in/out: ${data.usage?.prompt_tokens}/${data.usage?.completion_tokens}`)
    emit({
      type: 'reply',
      text: reply,
      ms,
      conversationId: conv.id,
      usage: data.usage ? { in: data.usage.prompt_tokens, out: data.usage.completion_tokens } : null,
    })
  } catch (err) {
    log.error(`chat failed: ${err.message}`)
    emit({ type: 'error', error: err.message })
  } finally {
    if (reservedTurn) activeTurns.delete(turnKey)
    res.end()
  }
})

export default router
