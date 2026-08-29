import { useCallback, useEffect, useRef, useState } from 'react'
import { onLive } from '@/lib/live'

/**
 * Fetch server data and keep it fresh: refetches whenever one of the given
 * realtime event types arrives over the SSE stream.
 *
 *   const { data, loading, error, refetch } = useApi(() => api.summary(period), [period], ['activity', 'daily'])
 */
export function useApi(fetcher, deps = [], events = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const refetch = useCallback(async () => {
    try {
      setError(null)
      const result = await fetcherRef.current()
      setData(result)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, deps)

  useEffect(() => {
    setLoading(true)
    refetch()
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
      if (!wanted.has(type)) return
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

  return { data, loading, error, refetch }
}
