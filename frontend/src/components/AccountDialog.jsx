import { useEffect, useState } from 'react'
import { HeartPulse, LineChart, Plug, ShieldCheck, User, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Progress from '@/pages/Progress'
import {
  GarminCard,
  HealthCard,
  PreferencesCard,
  ProfileCard,
  SessionCard,
  SpotifyCard,
} from '@/pages/Settings'

const SECTIONS = [
  { id: 'progress', label: 'Progress', icon: LineChart },
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'health', label: 'Health & goals', icon: HeartPulse },
  { id: 'integrations', label: 'Integrations', icon: Plug },
  { id: 'session', label: 'Session', icon: ShieldCheck },
]

/**
 * Claude-style settings modal opened from the sidebar profile block: overlay +
 * centered panel with its own internal sidebar, merging Progress and Settings.
 */
export default function AccountDialog({ open, onClose, onLogout, initial = 'progress' }) {
  const [section, setSection] = useState(initial)

  useEffect(() => {
    if (open) setSection(initial)
  }, [open, initial])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null
  const active = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0]

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Account settings">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />
      <div className="bg-card absolute top-1/2 left-1/2 flex h-[min(88vh,42rem)] w-[min(94vw,60rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border shadow-2xl md:flex-row">
        <nav className="bg-muted/30 flex shrink-0 gap-1 overflow-x-auto border-b p-2 md:w-48 md:flex-col md:overflow-visible md:border-r md:border-b-0 md:p-3">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSection(s.id)}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                s.id === section
                  ? 'bg-muted font-medium'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}
            >
              <s.icon className="size-4 shrink-0" />
              {s.label}
            </button>
          ))}
        </nav>

        <div className="relative min-w-0 flex-1 overflow-y-auto p-4 md:p-6">
          <Button
            size="icon"
            variant="ghost"
            className="absolute top-3 right-3 z-10 size-7"
            onClick={onClose}
            title="Close"
          >
            <X className="size-4" />
          </Button>
          <h1 className="page-title mb-3 text-xl md:text-2xl">{active.label}</h1>
          <div className="space-y-3">
            {section === 'progress' && <Progress embedded />}
            {section === 'profile' && <ProfileCard />}
            {section === 'health' && (
              <>
                <HealthCard />
                <PreferencesCard />
              </>
            )}
            {section === 'integrations' && (
              <>
                <GarminCard />
                <SpotifyCard />
              </>
            )}
            {section === 'session' && <SessionCard onLogout={onLogout} />}
          </div>
        </div>
      </div>
    </div>
  )
}
