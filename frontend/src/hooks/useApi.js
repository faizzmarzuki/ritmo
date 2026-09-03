import { useCallback, useEffect, useRef, useState } from 'react'
import { onLive } from '@/lib/live'

/**
 * Last successful response per request, so a screen paints its previous
 * content immediately instead of collapsing to a skeleton and reflowing when
 * the data lands. `inflight` lets a screen adopt a request that is already
 * running — a prefetch started at app boot — rather than firing a second one.
 */
const cache = new Map()
const inflight = new Map()

/** Drop everything. Call on logout so the next user starts clean. */
export function clearApiCache() {
  cache.clear()
  inflight.clear()
}

function fetchFresh(cacheKey, fetcher) {
  const p = Promise.resolve()
    .then(fetcher)
    .then((result) => {
      // Only cache while still the current request: a newer refetch may have
      // replaced us, or clearApiCache (logout) may have emptied the maps —
      // writing then would repopulate the cache with stale or prior-user data.
      if (inflight.get(cacheKey) === p) cache.set(cacheKey, result)
      return result
    })
  inflight.set(cacheKey, p)
  p.catch(() => {}).then(() => {
    if (inflight.get(cacheKey) === p) inflight.delete(cacheKey)
  })
  return p
}

/**
 * Warm a request before any screen asks for it, so opening that screen is an
 * instant paint rather than a skeleton. Cheap to call repeatedly: it no-ops if
 * the response is already cached or the request is already running, and a
 * failure is swallowed because nobody is waiting on it yet.
 */
export function prefetchApi(cacheKey, fetcher) {
  if (cache.has(cacheKey) || inflight.has(cacheKey)) return
  fetchFresh(cacheKey, fetcher).catch(() => {})
}

/**
 * Fetch server data and keep it fresh: refetches whenever one of the given
 * realtime event types arrives over the SSE stream.
 *
 *   const { data, loading, error, refetch } = useApi(() => api.summary(period), [period], ['activity'], `summary:${period}`)
 *
 * `cacheKey` identifies the request across mounts and to prefetchApi. Omit it
 * and one is derived from the fetcher's source plus its deps, which is stable
 * per call site but cannot be prefetched by name.
 */
export function useApi(fetcher, deps = [], events = [], cacheKey) {
  const key = cacheKey ?? `${fetcher}|${JSON.stringify(deps)}`
  const [data, setData] = useState(() => cache.get(key) ?? null)
  const [loading, setLoading] = useState(!cache.has(key))
  const [error, setError] = useState(null)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher
  const keyRef = useRef(key)
  keyRef.current = key
  // Orders this hook's own requests: only the newest one (adopted or refetched)
  // may publish state, so a stale success, failure, or loading flip is dropped.
  const reqIdRef = useRef(0)

  // Always goes to the network: callers use this after a mutation, so an
  // already-running request may predate the change they just made.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const refetch = useCallback(async () => {
    const id = ++reqIdRef.current
    try {
      setError(null)
      const k = keyRef.current
      const result = await fetchFresh(k, () => fetcherRef.current())
      // Paint only if this response is still the freshest for the key: an older
      // request resolving after a newer one (or after logout cleared the cache)
      // never made it into the cache, so it must not reach the screen either.
      // cache.has guards the miss-vs-cached-undefined ambiguity of Map.get.
      if (id === reqIdRef.current && cache.has(k) && cache.get(k) === result) setData(result)
    } catch (err) {
      if (id === reqIdRef.current) setError(err)
    } finally {
      if (id === reqIdRef.current) setLoading(false)
    }
  }, deps)

  useEffect(() => {
    const k = keyRef.current
    const cached = cache.get(k)
    if (cached !== undefined) {
      setData(cached)
      setLoading(false)
    } else {
      setLoading(true)
    }

    // Adopt a prefetch that is already on the wire instead of duplicating it.
    const pending = inflight.get(k)
    if (pending) {
      const id = ++reqIdRef.current
      let alive = true
      pending.then(
        (result) => {
          if (!alive || id !== reqIdRef.current) return
          // Same freshness rule as refetch: paint what actually got cached — our
          // result if it survived, or the fresher value that replaced it. When
          // nothing is cached (logout cleared it) publish neither data nor the
          // loading flip: a discarded request must not present as loaded-empty,
          // and logout unmounts the consumers anyway.
          if (cache.has(k)) {
            setData(cache.get(k))
            setLoading(false)
          }
        },
        (err) => {
          if (!alive || id !== reqIdRef.current) return
          setError(err)
          setLoading(false)
        },
      )
      return () => {
        alive = false
      }
    }
    refetch()
    return undefined
  }, [refetch])

  // Live events can fire every second (Bluetooth HR streaming); collapse
  // bursts so we refetch at most once per THROTTLE_MS, with a trailing call.
  const THROTTLE_MS = 5000
  const throttleRef = useRef({ last: 0, timer: null })
  const eventsKey = events.join(',')
  useEffect(() => {
    if (!eventsKey) return undefined
    const wanted = new Set(eventsKey.split(','))
    const t = throttleRef.current
    const off = onLive((type) => {
      if (!wanted.has(type) && type !== 'reconnect') return
      const now = Date.now()
      const wait = t.last + THROTTLE_MS - now
      if (wait <= 0) {
        t.last = now
        refetch()
      } else if (!t.timer) {
        t.timer = setTimeout(() => {
          t.timer = null
          t.last = Date.now()
          refetch()
        }, wait)
      }
    })
    return () => {
      off()
      clearTimeout(t.timer)
      t.timer = null
    }
  }, [eventsKey, refetch])

  // A tab that was hidden — the app backgrounded on a phone — may have missed
  // every event in the meantime, so refresh when it comes back into view.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') refetch()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refetch])

  return { data, loading, error, refetch }
}
