import { useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Backpack, Camera, Footprints, KeyRound, Loader2, LogOut, RefreshCw, Trash2, UserRound, Watch, X } from 'lucide-react'
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

const GEAR_FIELDS = [
  { key: 'gearShoes', label: 'Running shoes', icon: Footprints, placeholder: 'e.g. Nike Pegasus 41' },
  { key: 'gearWatch', label: 'Watch', icon: Watch, placeholder: 'e.g. Garmin Forerunner 265' },
  { key: 'gearOther', label: 'Other gear', icon: Backpack, placeholder: 'e.g. bike, headphones, lifting belt' },
]

/** What you train with — free text, saved with the rest of your settings. */
export function GearCard() {
  const { settings, update } = useSettings()

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-sm">
          <Backpack className="size-4" />
          Gear
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {GEAR_FIELDS.map(({ key, label, icon: Icon, placeholder }) => (
          <div key={key} className="space-y-1.5">
            <label htmlFor={key} className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
              <Icon className="size-3.5" />
              {label}
            </label>
            <Input
              id={key}
              value={settings[key] ?? ''}
              onChange={(e) => update({ [key]: e.target.value })}
              placeholder={placeholder}
              maxLength={80}
            />
          </div>
        ))}
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
      await api.connectGarminCredentials(creds.email, creds.password)
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
          ) : serverMode === 'official' ? (
            <Button size="sm" className="shrink-0" disabled={busy || !configured} onClick={connect}>
              {busy ? 'Connecting…' : 'Connect'}
            </Button>
          ) : null}
        </div>

        {serverMode === 'connect' && !garmin.connected && (
          <form
            onSubmit={(e) => { e.preventDefault(); connect() }}
            className="space-y-2 rounded-lg border p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Your Garmin account</p>
            </div>
            <p className="text-muted-foreground text-[11px]">
              Sign in with your own Garmin Connect account. Your details are stored encrypted
              in your local backend and used only to sync your data.
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
              {busy ? 'Signing in…' : 'Connect Garmin'}
            </Button>
          </form>
        )}

        {!configured && (
          <p className="text-muted-foreground text-[10px]">
            Garmin is disabled on this server (GARMIN_MODE=off, or official mode without API credentials).
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
  const { keys, busy: keysBusy, message: keysMessage, saveKeys } = useApiKeys()
  const [creds, setCreds] = useState({ clientId: '', clientSecret: '' })
  const [showCreds, setShowCreds] = useState(false)

  const sp = data?.spotify ?? { connected: false }
  const configured = data?.providers?.spotify?.configured
  const ownApp = keys['spotify.clientId']?.source === 'saved' || keys['spotify.clientSecret']?.source === 'saved'

  async function saveCreds() {
    const ok = await saveKeys({
      'spotify.clientId': creds.clientId.trim(),
      'spotify.clientSecret': creds.clientSecret.trim(),
    }, 'Saved — you can connect now.')
    if (ok) setCreds({ clientId: '', clientSecret: '' })
  }

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
        {configured && !ownApp && !showCreds && (
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground h-7 px-2 text-[11px]"
            onClick={() => setShowCreds(true)}
          >
            Use your own Spotify app instead
          </Button>
        )}
        {(!configured || ownApp || showCreds) && (
          <div className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Your Spotify app</p>
              <span className="text-muted-foreground text-[10px]">
                {ownApp ? `Your app ${keys['spotify.clientId']?.preview ?? ''}` : keyStatusText(keys['spotify.clientId'])}
              </span>
            </div>
            <p className="text-muted-foreground text-[11px]">
              Create a free app at developer.spotify.com/dashboard and paste its credentials here
              (stored encrypted, per account). Add this redirect URI to the app:
              {' '}<span className="text-foreground break-all">{data?.providers?.spotify?.redirectUri ?? 'loading…'}</span>
            </p>
            <Input
              type="password"
              autoComplete="off"
              placeholder="Client ID"
              value={creds.clientId}
              onChange={(e) => setCreds((c) => ({ ...c, clientId: e.target.value }))}
            />
            <Input
              type="password"
              autoComplete="off"
              placeholder="Client Secret"
              value={creds.clientSecret}
              onChange={(e) => setCreds((c) => ({ ...c, clientSecret: e.target.value }))}
            />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                disabled={keysBusy || !creds.clientId.trim() || !creds.clientSecret.trim()}
                onClick={saveCreds}
              >
                {keysBusy ? 'Saving…' : 'Save credentials'}
              </Button>
              {configured && !ownApp && showCreds && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground"
                  onClick={() => {
                    setShowCreds(false)
                    setCreds({ clientId: '', clientSecret: '' })
                  }}
                >
                  Cancel
                </Button>
              )}
              {ownApp && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={keysBusy}
                  onClick={() => saveKeys({ 'spotify.clientId': null, 'spotify.clientSecret': null }, 'Removed your Spotify app credentials.')}
                >
                  Remove
                </Button>
              )}
              {keysMessage && (
                <p
                  className={`text-[10px] ${keysMessage.ok ? 'text-muted-foreground' : 'text-destructive'}`}
                  role={keysMessage.ok ? undefined : 'alert'}
                >
                  {keysMessage.text}
                </p>
              )}
            </div>
          </div>
        )}
        {sp.lastError && <p className="text-destructive text-[10px]">Last error: {sp.lastError}</p>}
        {error && <p className="text-destructive text-[10px]" role="alert">{error}</p>}
      </CardContent>
    </Card>
  )
}

/** Shared state for the per-user API keys (masked statuses + save/clear). */
function useApiKeys() {
  const { data, refetch } = useApi(() => api.getApiKeys(), [], ['connection'])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null) // { ok: boolean, text: string }

  async function saveKeys(patch, okText = 'Saved — takes effect immediately.') {
    setMessage(null)
    setBusy(true)
    try {
      await api.updateApiKeys(patch)
      setMessage({ ok: true, text: okText })
      refetch()
      return true
    } catch (err) {
      setMessage({ ok: false, text: err.message })
      return false
    } finally {
      setBusy(false)
    }
  }

  return { keys: data?.keys ?? {}, busy, message, saveKeys }
}

function keyStatusText(k) {
  if (!k?.set) return 'Not set'
  if (k.source === 'saved') return `Your key ${k.preview}`
  return `Server default ${k.preview}`
}

export function AiCoachCard() {
  const { keys, busy, message, saveKeys } = useApiKeys()
  const [value, setValue] = useState('')

  const status = keys['vision.apiKey']

  async function save() {
    if (!value.trim()) return
    if (await saveKeys({ 'vision.apiKey': value.trim() })) setValue('')
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-sm">
          <KeyRound className="size-4" />
          AI coach &amp; food agent
        </CardTitle>
        <CardAction>
          {status?.set ? (
            <span className="flex items-center gap-1.5 text-[10px] font-medium text-[var(--neon)]">
              <span className="size-1.5 rounded-full bg-[var(--neon)]" />
              Active
            </span>
          ) : (
            <Badge variant="outline" className="text-[10px]">Not set</Badge>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-[11px]">
          Your own OpenAI API key powers the coach chat and food-photo analysis.
          Create one at platform.openai.com/api-keys — it is stored encrypted in
          your local backend and never shown again in full.
        </p>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="key-openai" className="text-sm font-medium">OpenAI API key</label>
            <span className="text-muted-foreground text-[10px]">{keyStatusText(status)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Input
              id="key-openai"
              type="password"
              autoComplete="off"
              placeholder="sk-…"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            {status?.source === 'saved' && (
              <Button
                size="sm"
                variant="outline"
                className="shrink-0"
                disabled={busy}
                onClick={() => saveKeys({ 'vision.apiKey': null }, 'Removed your key.')}
                title="Remove your saved key"
              >
                <X />
              </Button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" disabled={busy || !value.trim()} onClick={save}>
            {busy ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
            {busy ? 'Saving…' : 'Save key'}
          </Button>
          {message && (
            <p
              className={`text-[10px] ${message.ok ? 'text-muted-foreground' : 'text-destructive'}`}
              role={message.ok ? undefined : 'alert'}
            >
              {message.text}
            </p>
          )}
        </div>
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

const TABS = ['general', 'health', 'integrations']

export default function Settings({ onLogout }) {
  const [params, setParams] = useSearchParams()
  // ?tab=… deep-links from the You page; ?connect=… is the OAuth return.
  const requested = params.get('tab')
  const tab = TABS.includes(requested)
    ? requested
    : params.has('connect')
      ? 'integrations'
      : 'general'

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title text-xl md:text-2xl">Settings</h1>
        <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="health">Health &amp; goals</TabsTrigger>
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      {tab === 'general' && (
        <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="space-y-3">
            <ProfileCard />
          </div>
          <div className="space-y-3">
            <GearCard />
            <SessionCard onLogout={onLogout} />
          </div>
        </section>
      )}

      {tab === 'health' && (
        <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="space-y-3">
            <HealthCard />
          </div>
          <div className="space-y-3">
            <PreferencesCard />
          </div>
        </section>
      )}

      {tab === 'integrations' && (
        <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="space-y-3">
            <GarminCard />
            <AiCoachCard />
          </div>
          <div className="space-y-3">
            <SpotifyCard />
          </div>
        </section>
      )}
    </div>
  )
}
