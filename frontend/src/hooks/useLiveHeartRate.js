import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { onLive } from '@/lib/live'

/**
 * Current heart rate, updated the moment any source produces a sample:
 *  - SSE `heartRate` events (Garmin fast poll, or another tab streaming live)
 *  - this tab's own Bluetooth stream (via setLocal)
 * `stale` flips true when nothing has arrived for 15 s.
 */
export function useLiveBpm() {
  const [sample, setSample] = useState(null) // { bpm, ts, live }
  const [stale, setStale] = useState(true)
  const staleTimer = useRef(null)

  const bump = (bpm, live) => {
    setSample({ bpm, ts: Date.now(), live: Boolean(live) })
    setStale(false)
    clearTimeout(staleTimer.current)
    staleTimer.current = setTimeout(() => setStale(true), 15_000)
  }

  useEffect(() => {
    const off = onLive((type, data) => {
      if (type === 'heartRate' && Number.isFinite(data?.bpm)) bump(data.bpm, data.live)
    })
    return () => {
      off()
      clearTimeout(staleTimer.current)
    }
  }, [])

  return { bpm: sample?.bpm ?? null, live: Boolean(sample?.live && !stale), stale, setLocal: bump }
}

const HR_SERVICE = 'heart_rate'
const HR_CHAR = 'heart_rate_measurement'

/** Parse a BLE Heart Rate Measurement (GATT 0x2A37) value. */
function parseHrm(value) {
  const flags = value.getUint8(0)
  return flags & 0x1 ? value.getUint16(1, true) : value.getUint8(1)
}

/**
 * Streams the watch's Bluetooth HR broadcast into the app, one sample per beat
 * (~1/s). On Garmin watches: Settings → Sensors & Accessories → Broadcast
 * Heart Rate. Requires Chrome/Edge (Web Bluetooth); Safari doesn't support it.
 */
export function useBluetoothHr(onSample) {
  const [status, setStatus] = useState('idle') // idle | connecting | streaming | error
  const [error, setError] = useState('')
  const deviceRef = useRef(null)
  const lastSentRef = useRef(0)
  const supported = typeof navigator !== 'undefined' && Boolean(navigator.bluetooth)

  async function connect() {
    setError('')
    setStatus('connecting')
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [HR_SERVICE] }],
      })
      deviceRef.current = device
      device.addEventListener('gattserverdisconnected', () => setStatus('idle'))
      const server = await device.gatt.connect()
      const service = await server.getPrimaryService(HR_SERVICE)
      const char = await service.getCharacteristic(HR_CHAR)
      char.addEventListener('characteristicvaluechanged', (e) => {
        const bpm = parseHrm(e.target.value)
        if (!Number.isFinite(bpm) || bpm < 25 || bpm > 250) return
        onSample?.(bpm)
        // forward to the backend at most once per second
        const now = Date.now()
        if (now - lastSentRef.current >= 1000) {
          lastSentRef.current = now
          api.postHrLive(bpm).catch(() => { /* keep streaming; next beat retries */ })
        }
      })
      await char.startNotifications()
      setStatus('streaming')
    } catch (err) {
      if (err?.name === 'NotFoundError') {
        setStatus('idle') // user closed the device chooser
        return
      }
      setError(err.message || 'Bluetooth connection failed')
      setStatus('error')
    }
  }

  function disconnect() {
    try {
      deviceRef.current?.gatt?.disconnect()
    } catch {
      // already gone
    }
    setStatus('idle')
  }

  useEffect(() => () => deviceRef.current?.gatt?.disconnect?.(), [])

  return { supported, status, error, connect, disconnect }
}
