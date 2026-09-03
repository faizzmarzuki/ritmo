/**
 * Client for the project-fitness backend (server/).
 * Cookie-based sessions; every call includes credentials.
 *
 * Realtime: subscribeEvents(onEvent) opens an SSE stream — the backend pushes
 * typed events (activity, daily, sleep, nutrition, hydration, weight, goals,
 * bodyBattery, heartRate, connection, sync) the moment Garmin data lands.
 */
// Empty string is meaningful: same-origin requests via the Vite dev proxy.
const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

async function call(path, { method = 'GET', body, headers, cache } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    cache,
    credentials: 'include',
    headers: body instanceof FormData ? headers : { 'Content-Type': 'application/json', ...headers },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  })
  const data = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok) {
    const err = new Error(data?.error || `${res.status} ${res.statusText}`)
    err.status = res.status
    throw err
  }
  return data
}

export const api = {
  // auth
  register: (email, password, name) => call('/api/auth/register', { method: 'POST', body: { email, password, name } }),
  login: (email, password) => call('/api/auth/login', { method: 'POST', body: { email, password } }),
  logout: () => call('/api/auth/logout', { method: 'POST' }),
  me: () => call('/api/auth/me'),
  getSettings: () => call('/api/auth/settings'),
  updateSettings: (patch) => call('/api/auth/settings', { method: 'PATCH', body: patch }),

  // server API keys (OpenAI, Spotify app credentials) — GET returns masked status only
  getApiKeys: () => call('/api/settings/keys', { cache: 'no-store' }),
  updateApiKeys: (patch) => call('/api/settings/keys', { method: 'PUT', body: patch }),

  // integrations
  connections: () => call('/api/auth/connections'),
  connectGarmin: () => call('/api/auth/garmin/connect'),          // official: { url } · connect-mode: { needsCredentials }
  connectGarminCredentials: (email, password) =>
    call('/api/auth/garmin/connect-credentials', { method: 'POST', body: { email, password } }),
  disconnectGarmin: () => call('/api/auth/garmin/disconnect', { method: 'POST' }),
  syncGarmin: (days) => call('/api/auth/garmin/sync', { method: 'POST', body: { days } }),

  // data
  summary: (period = 'today') => call(`/api/summary?period=${period}`),
  workouts: () => call('/api/workouts'),
  activities: (params = {}) => call(`/api/activities?${new URLSearchParams(params)}`),
  activity: (id) => call(`/api/activities/${id}`),
  logWorkout: (workout) => call('/api/activities', { method: 'POST', body: workout }),
  deleteActivity: (id) => call(`/api/activities/${id}`, { method: 'DELETE' }),
  strengthExercises: () => call('/api/strength/exercises'),
  exerciseLibrary: () => call('/api/exercises'),
  exerciseGifUrl: (slug) => `${BASE}/api/exercise-gifs/${encodeURIComponent(slug)}.gif`,
  muscleRecovery: () => call('/api/strength/recovery'),
  nutrition: (date) => call(`/api/nutrition${date ? `?date=${date}` : ''}`),
  addMeal: (meal) => call('/api/meals', { method: 'POST', body: meal }),
  deleteMeal: (id) => call(`/api/meals/${id}`, { method: 'DELETE' }),
  deleteFoodItem: (id) => call(`/api/food-items/${id}`, { method: 'DELETE' }),
  addHydration: (ml) => call('/api/hydration', { method: 'POST', body: { ml } }),
  postHrLive: (bpm) => call('/api/hr/live', { method: 'POST', body: { bpm } }),
  progress: () => call('/api/progress'),
  addWeight: (weightKg) => call('/api/weights', { method: 'POST', body: { weightKg } }),
  goals: () => call('/api/goals'),
  logGoal: (id, done, date) => call(`/api/goals/${id}/log`, { method: 'POST', body: { done, date } }),

  // chat coach — persistent conversations
  chatConversations: () => call('/api/chat/conversations'),
  chatConversation: (id) => call(`/api/chat/conversations/${id}`),
  deleteChatConversation: (id) => call(`/api/chat/conversations/${id}`, { method: 'DELETE' }),

  // NDJSON stream: onStep(label) fires per research step, resolves with { text, ms, conversationId }.
  // turnId dedupes retries: resending with the same id replays the stored reply.
  chat: async (message, conversationId, onStep, turnId) => {
    const res = await fetch(`${BASE}/api/chat`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, conversationId, turnId }),
    })
    if (!res.ok || !res.body) {
      const data = await res.json().catch(() => null)
      throw new Error(data?.error || `${res.status} ${res.statusText}`)
    }
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    let reply = null
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      let nl
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim()
        buf = buf.slice(nl + 1)
        if (!line) continue
        const ev = JSON.parse(line)
        if (ev.type === 'step') onStep?.(ev.label)
        else if (ev.type === 'reply') reply = ev
        else if (ev.type === 'error') throw new Error(ev.error)
      }
    }
    if (!reply) throw new Error('The coach did not reply — try again.')
    return reply
  },

  // spotify
  connectSpotify: () => call('/api/auth/spotify/connect'),        // → { url }
  disconnectSpotify: () => call('/api/auth/spotify/disconnect', { method: 'POST' }),
  nowPlaying: () => call('/api/spotify/now-playing'),
  spotifyControl: (action) => call(`/api/spotify/control/${action}`, { method: 'POST' }),
  spotifyToken: () => call('/api/spotify/token'),
  spotifyTransfer: (deviceId) => call('/api/spotify/transfer', { method: 'POST', body: { deviceId } }),

  // food photo agent
  foodAgentStatus: () => call('/api/food/status'),
  analyzeFood: (file, hint) => {
    const form = new FormData()
    form.append('photo', file)
    if (hint) form.append('hint', hint)
    return call('/api/food/analyze', { method: 'POST', body: form })
  },
  // date (YYYY-MM-DD) logs onto an earlier day the nutrition page is browsing.
  analyzeAndLogFood: (file, slot, hint, date) => {
    const form = new FormData()
    form.append('photo', file)
    if (slot) form.append('slot', slot)
    if (hint) form.append('hint', hint)
    if (date) form.append('date', date)
    return call('/api/food/analyze-and-log', { method: 'POST', body: form })
  },
  logFoodByName: (name, slot, date) => call('/api/food/log-by-name', { method: 'POST', body: { name, slot, date } }),
  correctMeal: (mealId, name) => call(`/api/food/meals/${mealId}/correct`, { method: 'POST', body: { name } }),
  photoUrl: (photoPath) => `${BASE}/api/${photoPath}`,
}

/** Open the realtime stream. Returns an unsubscribe function. */
export function subscribeEvents(onEvent) {
  const source = new EventSource(`${BASE}/api/events`, { withCredentials: true })
  const types = [
    'activity', 'daily', 'sleep', 'nutrition', 'hydration', 'weight', 'goals',
    'bodyBattery', 'heartRate', 'metrics', 'connection', 'sync',
  ]
  const handler = (type) => (e) => {
    let data = {}
    try { data = JSON.parse(e.data) } catch { /* keep {} */ }
    onEvent(type, data)
  }
  for (const t of types) source.addEventListener(t, handler(t))
  // Events pushed while the connection was down are gone for good (a phone in
  // the background drops it), so a reconnect is announced as its own event and
  // every listener refetches.
  let wasOpen = false
  source.onopen = () => {
    if (wasOpen) onEvent('reconnect', {})
    wasOpen = true
  }
  source.onerror = () => { /* EventSource auto-reconnects */ }
  return () => source.close()
}
