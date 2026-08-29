import { ChevronRight, HeartPulse, Plug, Settings as SettingsIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useSettings } from '@/context/SettingsContext'
import Progress from '@/pages/Progress'

const LINKS = [
  { label: 'Health & goals', icon: HeartPulse, to: '/settings?tab=health' },
  { label: 'Integrations', icon: Plug, to: '/settings?tab=integrations' },
  { label: 'Settings', icon: SettingsIcon, to: '/settings' },
]

/**
 * The "You" tab: identity up top, quick links into Settings, and Progress
 * (weight, hydration, streaks, goals) as the main content.
 */
export default function You({ user }) {
  const { settings } = useSettings()

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-6">
      <header className="flex items-center gap-3">
        {settings.avatar ? (
          <img src={settings.avatar} alt="Profile" className="size-14 rounded-full object-cover" />
        ) : (
          <div className="bg-primary text-primary-foreground flex size-14 items-center justify-center rounded-full text-xl font-bold uppercase">
            {(settings.name || '?').charAt(0)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="page-title truncate text-xl md:text-2xl">{settings.name || 'You'}</h1>
          <p className="text-muted-foreground truncate text-xs capitalize">
            via {user?.provider ?? 'email'}
          </p>
        </div>
        <Link
          to="/settings"
          aria-label="Settings"
          className="text-muted-foreground hover:text-foreground hover:bg-muted/70 hidden size-9 items-center justify-center rounded-full transition-colors md:flex"
        >
          <SettingsIcon className="size-5" />
        </Link>
      </header>

      <section className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {LINKS.map((link) => (
          <Link
            key={link.label}
            to={link.to}
            className="bg-card hover:bg-muted/60 flex items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors"
          >
            <link.icon className="size-4 shrink-0 text-[var(--neon)]" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{link.label}</span>
            <ChevronRight className="text-muted-foreground size-4 shrink-0" />
          </Link>
        ))}
      </section>

      <Progress embedded />
    </div>
  )
}
