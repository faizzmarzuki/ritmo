import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'

const DEFAULTS = {
  name: '',
  avatar: null,
  units: 'metric',
  calorieGoal: 2200,
  proteinGoal: 160,
  carbsGoal: 250,
  fatGoal: 70,
  weeklyDistanceGoal: 25,
  waterGoalMl: 2500,
  burnGoal: 700,
  quitDate: null,
  cigarettesPerDay: 15,
  costPerCigarette: 0.6,
  startWeight: null,
  goalWeight: null,
  heightCm: 178,
}

const SettingsContext = createContext(null)

export function SettingsProvider({ user, children }) {
  const [settings, setSettings] = useState({ ...DEFAULTS, name: user?.name ?? '' })
  const saveTimer = useRef(null)
  const pending = useRef({})

  useEffect(() => {
    let cancelled = false
    api.getSettings()
      .then((s) => {
        if (!cancelled) setSettings((prev) => ({ ...prev, ...s, name: s.name || user?.name || '' }))
      })
      .catch(() => { /* keep defaults; server may be briefly unreachable */ })
    return () => { cancelled = true }
  }, [user])

  // Optimistic local update + debounced PATCH to the backend.
  const update = (patch) => {
    setSettings((s) => ({ ...s, ...patch }))
    pending.current = { ...pending.current, ...patch }
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const body = pending.current
      pending.current = {}
      api.updateSettings(body).catch(() => { /* retried on next change */ })
    }, 600)
  }

  return <SettingsContext value={{ settings, update }}>{children}</SettingsContext>
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) {
    throw new Error('useSettings must be used within SettingsProvider')
  }
  return ctx
}
