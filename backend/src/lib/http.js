import { logger } from './log.js'

const log = logger('http')

export class HttpError extends Error {
  constructor(status, message, body) {
    super(`${status} ${message}`)
    this.status = status
    this.body = body
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * fetch with retry on 429 / 5xx and honouring Retry-After.
 * Provider clients funnel every outbound call through here so a provider rate-limit
 * or a Garmin hiccup degrades into a delay rather than a lost sync.
 */
export async function request(url, { retries = 3, timeoutMs = 30_000, ...init } = {}) {
  let attempt = 0
  for (;;) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const res = await fetch(url, { ...init, signal: ctrl.signal })
      clearTimeout(timer)
      if (res.status === 429 || res.status >= 500) {
        if (attempt >= retries) {
          throw new HttpError(res.status, res.statusText, await safeText(res))
        }
        const retryAfter = Number(res.headers.get('retry-after'))
        const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 1000
        log.warn(`${res.status} from ${new URL(url).host} — retrying in ${wait}ms`)
        await sleep(wait)
        attempt += 1
        continue
      }
      if (!res.ok) throw new HttpError(res.status, res.statusText, await safeText(res))
      return res
    } catch (err) {
      clearTimeout(timer)
      if (err instanceof HttpError) throw err
      // redirect: 'error' rejections are a deliberate refusal to follow, not a
      // transient failure — retrying can never succeed, so surface immediately.
      if (/redirect/i.test(err?.message || '') || /redirect/i.test(err?.cause?.message || '')) throw err
      if (attempt >= retries) throw err
      await sleep(2 ** attempt * 500)
      attempt += 1
    }
  }
}

export async function requestJson(url, init) {
  const res = await request(url, init)
  if (res.status === 204) return null
  return res.json()
}

async function safeText(res) {
  try {
    return await res.text()
  } catch {
    return ''
  }
}

/** Simple token-bucket to stay under provider rate limits. */
export function rateLimiter({ tokens, intervalMs }) {
  let available = tokens
  let queue = Promise.resolve()
  setInterval(() => {
    available = tokens
  }, intervalMs).unref?.()

  return function limited(fn) {
    queue = queue.then(async () => {
      while (available <= 0) await sleep(1000)
      available -= 1
    })
    return queue.then(fn)
  }
}
