import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext(null)

function applyTheme(theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#0a0a0a' : '#fafafa')
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('pf-theme') ?? 'dark'
    } catch {
      return 'dark'
    }
  })

  useEffect(() => {
    applyTheme(theme)
    try {
      localStorage.setItem('pf-theme', theme)
    } catch {
      // storage unavailable
    }
  }, [theme])

  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  return <ThemeContext value={{ theme, toggle }}>{children}</ThemeContext>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return ctx
}
