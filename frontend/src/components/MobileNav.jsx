import { useViewportSettled } from '@/hooks/useViewportSettled'
import { BotMessageSquare, Dumbbell, House, Nut, Settings } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useSettings } from '@/context/SettingsContext'
import RitmoLogo from '@/components/RitmoLogo'

/**
 * Mobile app chrome (hidden ≥ md, where the sidebar takes over): a slim top
 * header with the Ritmo logo, and an iOS-style bottom tab bar. Both pad for
 * the iPhone notch / home indicator via safe-area insets.
 */

export function MobileHeader() {
  const { pathname } = useLocation()
  const onYou = pathname.startsWith('/you')
  const onCoach = pathname.startsWith('/coach')

  return (
    <header className="bg-background/90 sticky top-0 z-40 border-b backdrop-blur-md pt-[env(safe-area-inset-top)] md:hidden">
      <div className="relative flex h-12 items-center justify-center">
        <Link to="/" aria-label="Ritmo home">
          <RitmoLogo className="text-foreground h-6 w-auto" />
        </Link>
        <div className="absolute right-2 flex items-center">
          {onYou && (
            <Link
              to="/settings"
              aria-label="Settings"
              className="text-muted-foreground hover:text-foreground flex size-9 items-center justify-center rounded-full transition-colors"
            >
              <Settings className="size-5" />
            </Link>
          )}
          <Link
            to="/coach"
            aria-label="Ask your health coach"
            aria-current={onCoach ? 'page' : undefined}
            className={`flex size-9 items-center justify-center rounded-full transition-colors ${
              onCoach ? 'bg-[var(--neon)]/10 text-[var(--neon)]' : 'text-[var(--neon)]'
            }`}
          >
            <BotMessageSquare className="size-5" />
          </Link>
        </div>
      </div>
    </header>
  )
}

const TABS = [
  { title: 'Home', icon: House, path: '/' },
  { title: 'Workouts', icon: Dumbbell, path: '/workouts' },
  { title: 'Nutrition', icon: Nut, path: '/nutrition' },
]

function YouAvatar({ active }) {
  const { settings } = useSettings()
  const ring = active ? 'ring-2 ring-[var(--neon)]' : 'ring-1 ring-border'
  if (settings.avatar) {
    return (
      <img
        src={settings.avatar}
        alt=""
        className={`size-6 rounded-full object-cover ${ring}`}
      />
    )
  }
  return (
    <span
      className={`bg-muted flex size-6 items-center justify-center rounded-full text-[10px] font-semibold uppercase ${ring} ${active ? 'text-foreground' : 'text-muted-foreground'}`}
    >
      {(settings.name || '?').charAt(0)}
    </span>
  )
}

export function BottomNav() {
  const { pathname } = useLocation()
  // Settings is reached from the You tab, so keep You highlighted there too.
  const youActive = pathname.startsWith('/you') || pathname.startsWith('/settings')
  // iOS corrects the standalone viewport height a beat after first paint; stay
  // invisible until it has, so the bar never appears and then jumps.
  const settled = useViewportSettled()

  const itemClass = (active) =>
    `flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-medium transition-colors ${
      active ? 'text-foreground' : 'text-muted-foreground'
    }`

  return (
    <nav
      aria-label="Primary"
      className={`from-background via-background/85 fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t to-transparent pt-3 pb-[env(safe-area-inset-bottom)] transition-opacity duration-150 md:hidden ${
        settled ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="flex h-14 items-stretch">
        {TABS.map((tab) => {
          const active = tab.path === '/' ? pathname === '/' : pathname.startsWith(tab.path)
          return (
            <Link key={tab.title} to={tab.path} className={itemClass(active)} aria-current={active ? 'page' : undefined}>
              <tab.icon className={`size-5 ${active ? 'text-[var(--neon)]' : ''}`} />
              {tab.title}
            </Link>
          )
        })}
        <Link to="/you" className={itemClass(youActive)} aria-current={youActive ? 'page' : undefined}>
          <YouAvatar active={youActive} />
          You
        </Link>
      </div>
    </nav>
  )
}
