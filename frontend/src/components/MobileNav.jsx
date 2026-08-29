import { Dumbbell, House, Nut, Settings } from 'lucide-react'
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

  return (
    <header className="bg-background/90 sticky top-0 z-40 border-b backdrop-blur-md pt-[env(safe-area-inset-top)] md:hidden">
      <div className="relative flex h-12 items-center justify-center">
        <Link to="/" aria-label="Ritmo home">
          <RitmoLogo className="text-foreground h-6 w-auto" />
        </Link>
        {onYou && (
          <Link
            to="/settings"
            aria-label="Settings"
            className="text-muted-foreground hover:text-foreground absolute right-3 flex size-9 items-center justify-center rounded-full transition-colors"
          >
            <Settings className="size-5" />
          </Link>
        )}
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

  const itemClass = (active) =>
    `flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-medium transition-colors ${
      active ? 'text-foreground' : 'text-muted-foreground'
    }`

  return (
    <nav
      aria-label="Primary"
      className="bg-background/90 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-md pb-[env(safe-area-inset-bottom)] md:hidden"
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
