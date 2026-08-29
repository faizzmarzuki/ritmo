import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import LoginPage from './components/LoginPage.jsx'
import AppShell from './components/AppShell.jsx'
import Dashboard from './components/Dashboard.jsx'
import Workouts from './pages/Workouts.jsx'
import Nutrition from './pages/Nutrition.jsx'
import { api } from './lib/api'
import { stopLive } from './lib/live'

export default function App() {
  const [user, setUser] = useState(null)
  const [booting, setBooting] = useState(true)

  // Restore the session cookie on load.
  useEffect(() => {
    api.me()
      .then(({ user: u }) => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setBooting(false))
  }, [])

  async function handleLogout() {
    stopLive()
    try {
      await api.logout()
    } catch {
      // session may already be gone
    }
    setUser(null)
  }

  if (booting) {
    return (
      <div className="text-muted-foreground flex min-h-svh items-center justify-center text-sm">
        Loading…
      </div>
    )
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <LoginPage onLogin={setUser} />}
      />
      <Route
        element={user ? <AppShell user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />}
      >
        <Route index element={<Dashboard user={user} />} />
        <Route path="workouts" element={<Workouts />} />
        <Route path="nutrition" element={<Nutrition />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
