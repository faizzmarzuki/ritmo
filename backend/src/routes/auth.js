import { Router } from 'express'
import { config } from '../config.js'
import { createUser, findUserByEmail, authenticate, createSession, destroySession, getSettings, updateSettings } from '../db/repo/users.js'
import { requireAuth, COOKIE } from '../auth/middleware.js'

const router = Router()

const cookieOpts = {
  httpOnly: true,
  sameSite: 'lax',
  secure: config.publicUrl.startsWith('https'),
  maxAge: 30 * 86_400_000,
  path: '/',
}

router.post('/register', (req, res) => {
  const { email, password, name } = req.body || {}
  if (!email || !password || password.length < 8) {
    return res.status(400).json({ error: 'Email and a password of at least 8 characters are required.' })
  }
  if (findUserByEmail(email)) return res.status(409).json({ error: 'An account with that email already exists.' })
  const user = createUser({ email, password, name: name || email.split('@')[0] })
  const session = createSession(user.id)
  res.cookie(COOKIE, session.token, cookieOpts)
  res.json({ user, token: session.token })
})

router.post('/login', (req, res) => {
  const { email, password } = req.body || {}
  const user = authenticate(email, password)
  if (!user) return res.status(401).json({ error: 'Invalid email or password.' })
  const session = createSession(user.id)
  res.cookie(COOKIE, session.token, cookieOpts)
  res.json({ user, token: session.token })
})

router.post('/logout', requireAuth, (req, res) => {
  destroySession(req.sessionToken)
  res.clearCookie(COOKIE, { path: '/' })
  res.json({ ok: true })
})

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user, settings: getSettings(req.user.id) })
})

router.get('/settings', requireAuth, (req, res) => res.json(getSettings(req.user.id)))
router.patch('/settings', requireAuth, (req, res) => res.json(updateSettings(req.user.id, req.body || {})))

export default router
