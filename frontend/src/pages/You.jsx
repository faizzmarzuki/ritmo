import { Settings as SettingsIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useSettings } from '@/context/SettingsContext'
import Progress from '@/pages/Progress'

/**
 * The "You" tab: identity up top and Progress (weight, hydration, streaks,
 * goals) as the main content. Settings is reached from the header gear.
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

      <Progress embedded />
    </div>
  )
}
