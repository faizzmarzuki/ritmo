import { subscribeEvents } from './api'

/**
 * One SSE connection per session, fanned out to any number of hook listeners.
 * AppShell calls startLive() after login; useApi() hooks register interest in
 * specific event types and refetch when they arrive.
 */
const listeners = new Set()
let stop = null

export function startLive() {
  if (stop) return
  stop = subscribeEvents((type, data) => {
    for (const fn of listeners) fn(type, data)
  })
}

export function stopLive() {
  stop?.()
  stop = null
}

export function onLive(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
