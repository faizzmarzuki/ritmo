/** All day-bucketing in the app happens in the server's local timezone. */
export function toDateKey(d = new Date()) {
  const date = d instanceof Date ? d : new Date(d)
  const off = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - off).toISOString().slice(0, 10)
}

export const startOfDay = (dateKey) => new Date(`${dateKey}T00:00:00`)
export const endOfDay = (dateKey) => new Date(`${dateKey}T23:59:59.999`)

export function addDays(dateKey, n) {
  const d = startOfDay(dateKey)
  d.setDate(d.getDate() + n)
  return toDateKey(d)
}

/** Monday-based week start, matching how the dashboard labels Mon…Sun. */
export function startOfWeek(dateKey) {
  const d = startOfDay(dateKey)
  const day = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - day)
  return toDateKey(d)
}

export function startOfMonth(dateKey) {
  return `${dateKey.slice(0, 7)}-01`
}

export function startOfYear(dateKey) {
  return `${dateKey.slice(0, 4)}-01-01`
}

export function rangeFor(period, today = toDateKey()) {
  switch (period) {
    case 'week':
      return { from: startOfWeek(today), to: today, prevFrom: addDays(startOfWeek(today), -7), prevTo: addDays(startOfWeek(today), -1) }
    case 'month': {
      const from = startOfMonth(today)
      const prevFrom = startOfMonth(addDays(from, -1))
      return { from, to: today, prevFrom, prevTo: addDays(from, -1) }
    }
    case 'year': {
      const from = startOfYear(today)
      return { from, to: today, prevFrom: `${Number(today.slice(0, 4)) - 1}-01-01`, prevTo: addDays(from, -1) }
    }
    case 'today':
    default:
      return { from: today, to: today, prevFrom: addDays(today, -1), prevTo: addDays(today, -1) }
  }
}

export function eachDay(from, to) {
  const out = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

export const secondsToClock = (s) => {
  const total = Math.max(0, Math.round(s || 0))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = total % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`
}

export const minutesToHm = (min) => {
  const m = Math.max(0, Math.round(min || 0))
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
}

export const paceLabel = (secPerKm) => {
  if (!Number.isFinite(secPerKm) || secPerKm <= 0) return '—'
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
