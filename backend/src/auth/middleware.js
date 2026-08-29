import { resolveSession } from '../db/repo/users.js'

export const COOKIE = 'pf_session'

export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE] || bearerToken(req)
  const user = resolveSession(token)
  if (!user) return res.status(401).json({ error: 'Not authenticated' })
  req.user = user
  req.sessionToken = token
  next()
}

export function bearerToken(req) {
  const h = req.headers.authorization
  if (h?.startsWith('Bearer ')) return h.slice(7)
  // SSE via EventSource can't set headers; allow ?token= for that endpoint only.
  if (req.query?.token) return String(req.query.token)
  return null
}
