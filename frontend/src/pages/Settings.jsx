import { useRef, useState } from 'react'
import { Camera, Loader2, LogOut, RefreshCw, Trash2, UserRound } from 'lucide-react'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSettings } from '@/context/SettingsContext'
import { GarminLogo, SpotifyLogo } from '@/components/BrandLogos'
import { api } from '@/lib/api'
import { useApi } from '@/hooks/useApi'

const KM_TO_MI = 0.621371
const ML_TO_OZ = 1 / 29.5735
const KG_TO_LB = 2.20462

export function ProfileCard() {
  const { settings, update } = useSettings()
  const fileRef = useRef(null)

  function onPickFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => update({ avatar: reader.result })
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-sm">
          <UserRound className="size-4" />
          Profile
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="group relative size-14 shrink-0 cursor-pointer rounded-full"
            title="Change profile picture"
          >
            {settings.avatar ? (
              <img
                src={settings.avatar}
                alt="Profile"
                className="size-14 rounded-full object-cover"
              />
            ) : (
              <div className="bg-primary text-primary-foreground flex size-14 items-center justify-center rounded-full text-xl font-bold uppercase">
                {(settings.name ?? '?').charAt(0)}
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/55 opacity-0 transition-opacity group-hover:opacity-100">
              <Camera className="size-5 text-white" />
            </div>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPickFile}
          />
          <div className="min-w-0 flex-1 space-y-2">
            <label htmlFor="display-name" className="text-muted-foreground text-xs font-medium">
              Display name
            </label>
            <Input
              id="display-name"
              value={settings.name}
              onChange={(e) => update({ name: e.target.value })}
              placeholder="Your name"
              maxLength={40}
            />
          </div>
        </div>

        {settings.avatar && (
          <Button
            variant="outline"
            size="sm"
            className="text-destructive"
            onClick={() => update({ avatar: null })}
          >
            <Trash2 data-icon="inline-start" />
            Remove photo
          </Button>
        )}

        <Separator />

        <div className="text-muted-foreground grid grid-cols-2 gap-2 text-xs">
          <span>Sign-in method</span>
          <span className="text-right font-medium text-foreground">Email &amp; password</span>
          <span>Data storage</span>
          <span className="text-right font-medium text-foreground">Local backend (SQLite)</span>
        </div>
      </CardContent>
    </Card>
  )
}

export function PreferencesCard() {
  const { settings, update } = useSettings()
  const imperial = settings.units === 'imperial'

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-sm">Preferences & goals</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Units</p>
            <p className="text-muted-foreground text-[11px]">
              {imperial ? 'Pounds, miles, fluid ounces' : 'Kilograms, kilometers, liters'}
            </p>
          </div>
          <Tabs value={settings.units} onValueChange={(v) => update({ units: v })}>
            <TabsList>
              <TabsTrigger value="metric">Metric</TabsTrigger>
              <TabsTrigger value="imperial">Imperial</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <Separator />

        <div className="space-y-1.5">
          <label htmlFor="calorie-goal" className="text-sm font-medium">
            Daily calorie goal
          </label>
          <div className="relative">
            <Input
              id="calorie-goal"
              type="number"
              min={800}
              max={6000}
              value={settings.calorieGoal}
              onChange={(e) => update({ calorieGoal: Number(e.target.value) || 0 })}
            />
            <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs">
              kcal
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="distance-goal" className="text-sm font-medium">
            Weekly distance goal
          </label>
          <div className="relative">
            <Input
              id="distance-goal"
              type="number"
              min={0}
              step={imperial ? 0.1 : 1}
              value={
                imperial
                  ? Math.round(settings.weeklyDistanceGoal * KM_TO_MI * 10) / 10
                  : settings.weeklyDistanceGoal
              }
              onChange={(e) => {
                const v = Number(e.target.value) || 0
                update({
                  weeklyDistanceGoal: imperial
                    ? Math.round((v / KM_TO_MI) * 10) / 10
                    : v,
                })
              }}
            />
            <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs">
              {imperial ? 'mi' : 'km'}
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="water-goal" className="text-sm font-medium">
            Daily water goal
          </label>
          <div className="relative">
            <Input
              id="water-goal"
              type="number"
              min={0}
              step={imperial ? 1 : 0.1}
              value={
                imperial
                  ? Math.round(settings.waterGoalMl * ML_TO_OZ)
                  : Math.round((settings.waterGoalMl / 1000) * 10) / 10
              }
              onChange={(e) => {
                const v = Number(e.target.value) || 0
                update({
                  waterGoalMl: imperial
                    ? Math.round(v / ML_TO_OZ)
                    : Math.round(v * 1000),
                })
              }}
            />
            <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs">
              {imperial ? 'fl oz' : 'L'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function HealthCard() {
  const { settings, update } = useSettings()
  const imperial = settings.units === 'imperial'

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-sm">Health baseline</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="quit-date" className="text-sm font-medium">
            Smoke-free since
          </label>
          <Input
            id="quit-date"
            type="date"
            value={settings.quitDate}
            onChange={(e) => update({ quitDate: e.target.value })}
          />
          <p className="text-muted-foreground text-[10px]">
            Drives your smoke-free streak, savings and milestones
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="start-weight" className="text-sm font-medium">
            First logged weight
          </label>
          <div className="relative">
            <Input
              id="start-weight"
              type="number"
              min={0}
              step={0.1}
              value={
                imperial
                  ? Math.round(settings.startWeight * KG_TO_LB * 10) / 10
                  : settings.startWeight
              }
              onChange={(e) => {
                const v = Number(e.target.value) || 0
                update({
                  startWeight: imperial
                    ? Math.round((v / KG_TO_LB) * 10) / 10
                    : v,
                })
              }}
            />
            <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs">
              {imperial ? 'lbs' : 'kg'}
            </span>
          </div>
          <p className="text-muted-foreground text-[10px]">
            Your starting point for the weight journey
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

export function GarminCard() {
  const { data, refetch } = useApi(() => api.connections(), [], ['connection', 'sync'])
  const [creds, setCreds] = useState({ email: '', password: '' })
  const [showForm, setShowForm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const garmin = data?.garmin ?? { connected: false }
  const serverMode = data?.providers?.garmin?.mode
  const configured = data?.providers?.garmin?.configured

  async function connect() {
    setError('')
    setBusy(true)
    try {
      if (serverMode === 'official') {
        const { url } = await api.connectGarmin()
        window.location.href = url
        return
      }
      // connect mode: use server-side credentials if present, else show the form
      const info = await api.connectGarmin()
      if (info.needsCredentials && !creds.email) {
        setShowForm(true)
        return
      }
      await api.connectGarminCredentials(creds.email || undefined, creds.password || undefined)
      setShowForm(false)
      setCreds({ email: '', password: '' })
      refetch()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function disconnect() {
    setBusy(true)
    try {
      await api.disconnectGarmin()
      refetch()
    } finally {
      setBusy(false)
    }
  }

  async function syncNow() {
    setError('')
    setBusy(true)
    try {
      await api.syncGarmin()
      refetch()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-sm">Garmin integration</CardTitle>
        <CardAction>
          {garmin.connected ? (
            <span className="flex items-center gap-1.5 text-[10px] font-medium text-[var(--neon)]">
              <span className="size-1.5 rounded-full bg-[var(--neon)]" />
              Connected
            </span>
          ) : (
            <Badge variant="outline" className="text-[10px]">Not connected</Badge>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3 rounded-lg border p-3">
          <div className="bg-background flex size-10 shrink-0 items-center justify-center rounded-lg border">
            <GarminLogo className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">Garmin</p>
            <p className="text-muted-foreground truncate text-[11px]">
              {garmin.connected
                ? `Activities, HR, sleep & body battery · ${garmin.lastSyncAt ? `last sync ${new Date(garmin.lastSyncAt + 'Z').toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : 'waiting for first sync'}`
                : serverMode === 'official'
                  ? 'Health API push — realtime'
                  : 'Garmin Connect account sync (polls every 5 min)'}
            </p>
          </div>
          {garmin.connected ? (
            <div className="flex shrink-0 items-center gap-1.5">
              <Button size="sm" variant="outline" disabled={busy} onClick={syncNow} title="Sync now">
                {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={disconnect}>
                Disconnect
              </Button>
            </div>
          ) : (
            <Button size="sm" className="shrink-0" disabled={busy || !configured} onClick={connect}>
              {busy ? 'Connecting…' : 'Connect'}
            </Button>
          )}
        </div>

        {showForm && !garmin.connected && (
          <form
            onSubmit={(e) => { e.preventDefault(); connect() }}
            className="space-y-2 rounded-lg border p-3"
          >
            <p className="text-muted-foreground text-[11px]">
              Enter your Garmin Connect login. It is sent only to your own local backend.
            </p>
            <Input
              type="email"
              placeholder="Garmin Connect email"
              value={creds.email}
              onChange={(e) => setCreds((c) => ({ ...c, email: e.target.value }))}
              autoComplete="off"
            />
            <Input
              type="password"
              placeholder="Garmin Connect password"
              value={creds.password}
              onChange={(e) => setCreds((c) => ({ ...c, password: e.target.value }))}
              autoComplete="off"
            />
            <Button type="submit" size="sm" disabled={busy || !creds.email || !creds.password}>
              {busy ? 'Signing in…' : 'Sign in to Garmin'}
            </Button>
          </form>
        )}

        {!configured && (
          <p className="text-muted-foreground text-[10px]">
            The backend has no Garmin credentials yet — set GARMIN_EMAIL / GARMIN_PASSWORD
            in server/.env (or use the form after clicking Connect).
          </p>
        )}
        {garmin.lastError && (
          <p className="text-destructive text-[10px]">Last error: {garmin.lastError}</p>
        )}
        {error && <p className="text-destructive text-[10px]" role="alert">{error}</p>}
      </CardContent>
    </Card>
  )
}

export function SpotifyCard() {
  const { data, refetch } = useApi(() => api.connections(), [], ['connection'])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const sp = data?.spotify ?? { connected: false }
  const configured = data?.providers?.spotify?.configured

  async function connect() {
    setError('')
    setBusy(true)
    try {
      const { url } = await api.connectSpotify()
      window.location.href = url
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  async function disconnect() {
    setBusy(true)
    try {
      await api.disconnectSpotify()
      refetch()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-sm">Spotify</CardTitle>
        <CardAction>
          {sp.connected ? (
            <span className="flex items-center gap-1.5 text-[10px] font-medium text-[#1DB954]">
              <span className="size-1.5 rounded-full bg-[#1DB954]" />
              Connected
            </span>
          ) : (
            <Badge variant="outline" className="text-[10px]">Not connected</Badge>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3 rounded-lg border p-3">
          <div className="bg-background flex size-10 shrink-0 items-center justify-center rounded-lg border">
            <SpotifyLogo className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {sp.connected && sp.displayName ? sp.displayName : 'Spotify'}
            </p>
            <p className="text-muted-foreground truncate text-[11px]">
              {sp.connected
                ? `Now-playing & playback control${sp.premium ? ' · Premium' : ' · Free plan (control needs Premium)'}`
                : 'Show and control what you are listening to'}
            </p>
          </div>
          {sp.connected ? (
            <Button size="sm" variant="outline" className="shrink-0" disabled={busy} onClick={disconnect}>
              Disconnect
            </Button>
          ) : (
            <Button size="sm" className="shrink-0" disabled={busy || !configured} onClick={connect}>
              {busy ? 'Redirecting…' : 'Connect'}
            </Button>
          )}
        </div>
        {!configured && (
          <p className="text-muted-foreground text-[10px]">
            Set SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET in server/.env first — create the app at
            developer.spotify.com/dashboard with redirect URI http://127.0.0.1:4000/api/auth/spotify/callback.
          </p>
        )}
        {sp.lastError && <p className="text-destructive text-[10px]">Last error: {sp.lastError}</p>}
        {error && <p className="text-destructive text-[10px]" role="alert">{error}</p>}
      </CardContent>
    </Card>
  )
}

export function SessionCard({ onLogout }) {
  const { settings } = useSettings()
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-sm">Session</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-xs">
          Signed in as <span className="text-foreground font-medium">{settings.name}</span>.
          All data is stored in your local backend (server/data).
        </p>
        <div>
          <Button variant="destructive" size="sm" onClick={onLogout}>
            <LogOut data-icon="inline-start" />
            Log out
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function Settings({ onLogout }) {
  const { settings } = useSettings()

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-6">
      <header>
        <h1 className="page-title text-xl md:text-2xl">Settings</h1>
      </header>

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="space-y-3">
          <ProfileCard />
          <HealthCard />
        </div>
        <div className="space-y-3">
          <PreferencesCard />
          <GarminCard />
          <SpotifyCard />
          <Card size="sm">
            <CardHeader>
              <CardTitle className="text-sm">Session</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-muted-foreground text-xs">
                Signed in as <span className="text-foreground font-medium">{settings.name}</span>.
                All data is stored in your local backend (server/data).
              </p>
              <div>
                <Button variant="destructive" size="sm" onClick={onLogout}>
                  <LogOut data-icon="inline-start" />
                  Log out
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
