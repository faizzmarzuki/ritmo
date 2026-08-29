import { useState } from 'react'
import { api } from '@/lib/api'
import RitmoLogo from '@/components/RitmoLogo'
import './LoginPage.css'

export default function LoginPage({ onLogin }) {
  const [mode, setMode] = useState('login') // login | signup
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email || !password) {
      setError('Please enter your email and password.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = mode === 'signup'
        ? await api.register(email, password, name || email.split('@')[0])
        : await api.login(email, password)
      onLogin(res.user)
    } catch (err) {
      setError(err.message || 'Something went wrong — is the backend running?')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="login-page">
      <div className="login-card">
        <div className="brand">
          <RitmoLogo className="brand-lockup" />
          <p>{mode === 'signup' ? 'Create your account' : 'Log in to track your workouts'}</p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {mode === 'signup' && (
            <>
              <label htmlFor="name">Name</label>
              <input
                id="name"
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </>
          )}

          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          />

          {error && (
            <p className="error" role="alert">{error}</p>
          )}

          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Log in'}
          </button>
        </form>

        <p className="signup-hint">
          {mode === 'signup' ? (
            <>Already have an account?{' '}
              <a href="#login" onClick={(e) => { e.preventDefault(); setMode('login'); setError('') }}>Log in</a>
            </>
          ) : (
            <>No account yet?{' '}
              <a href="#signup" onClick={(e) => { e.preventDefault(); setMode('signup'); setError('') }}>Sign up</a>
            </>
          )}
        </p>
      </div>
    </main>
  )
}
