import { logger } from '../lib/log.js'

const log = logger('sse')

/**
 * Server-Sent Events hub. Every browser tab opens GET /api/events and keeps it
 * open; when a webhook lands or a sync writes new rows we broadcast a typed
 * event and the frontend refetches just the affected slice.
 */
const clients = new Map() // userId -> Set<res>
let nextId = 1

export function subscribe(userId, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  res.write(`retry: 3000\n\n`)
  res.write(`event: hello\ndata: {"ok":true}\n\n`)

  if (!clients.has(userId)) clients.set(userId, new Set())
  clients.get(userId).add(res)
  log.debug(`client connected user=${userId} total=${clients.get(userId).size}`)

  const ping = setInterval(() => {
    try {
      res.write(`: ping ${Date.now()}\n\n`)
    } catch {
      cleanup()
    }
  }, 25_000)

  function cleanup() {
    clearInterval(ping)
    clients.get(userId)?.delete(res)
  }
  res.on('close', cleanup)
}

export function publish(userId, type, data = {}) {
  const set = clients.get(userId)
  if (!set?.size) return
  const payload = `id: ${nextId++}\nevent: ${type}\ndata: ${JSON.stringify(data)}\n\n`
  for (const res of set) {
    try {
      res.write(payload)
    } catch {
      set.delete(res)
    }
  }
  log.debug(`published ${type} to ${set.size} client(s) of user=${userId}`)
}

export const connectedClients = (userId) => clients.get(userId)?.size ?? 0
