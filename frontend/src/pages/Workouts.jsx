import { useRef, useState } from 'react'
import {
  Activity,
  Bike,
  Dumbbell,
  Flame,
  Footprints,
  Loader2,
  Maximize2,
  Minus,
  Plus,
  Route,
  Search,
  Target,
  Timer,
  Trash2,
  TrendingUp,
  Trophy,
  Waves,
  X,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import EmptyState from '@/components/EmptyState'
import MuscleRecoveryCard from '@/components/MuscleRecoveryCard'
import { api } from '@/lib/api'
import { useApi } from '@/hooks/useApi'
import { useSettings } from '@/context/SettingsContext'

const distanceConfig = {
  km: { label: 'Distance', color: 'var(--neon)' },
}

const paceConfig = {
  pace: { label: 'Pace', color: 'var(--neon)' },
}

const fmtPace = (p) =>
  `${Math.floor(p)}:${String(Math.round((p % 1) * 60)).padStart(2, '0')}`

const SPORT_ICONS = { run: Footprints, walk: Footprints, ride: Bike, swim: Waves, strength: Dumbbell }

// Equipment slugs from the scraped exercise library worth filtering by.
const EQUIP_FILTERS = [
  ['all', 'All'],
  ['machine', 'Machine'],
  ['cable', 'Cable'],
  ['barbell', 'Barbell'],
  ['dumbbells', 'Dumbbell'],
  ['no-equipment', 'Bodyweight'],
  ['kettlebell', 'Kettlebell'],
]

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-muted-foreground text-[11px] font-medium">{label}</span>
      {children}
    </label>
  )
}

/**
 * Square demo-GIF thumbnail; falls back to a dumbbell glyph when there's no
 * GIF. With `onPreview` the square becomes a button that opens an enlarged
 * view of the demo.
 */
function ExerciseGif({ slug, hasGif, className = '', onPreview }) {
  // Aborted downloads (e.g. the suggestion list unmounting while its GIFs are
  // still streaming) fire onError too — retry with a cache-buster before
  // giving up on the image.
  const [attempt, setAttempt] = useState(0)
  const showGif = hasGif && attempt < 3
  const frame = `border-border/70 relative flex shrink-0 items-center justify-center overflow-hidden rounded-md border ${
    showGif ? 'bg-white' : 'bg-muted'
  } ${className}`
  const content = showGif ? (
    <img
      src={api.exerciseGifUrl(slug) + (attempt ? `?retry=${attempt}` : '')}
      alt=""
      loading="lazy"
      onError={() => setAttempt((a) => a + 1)}
      className="h-full w-full object-contain"
    />
  ) : (
    <Dumbbell className="text-muted-foreground size-4" />
  )
  if (!onPreview || !showGif) return <div className={frame}>{content}</div>
  return (
    <button
      type="button"
      aria-label="Enlarge exercise demo"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onPreview}
      className={`${frame} cursor-zoom-in`}
    >
      {content}
      <span className="absolute right-0 bottom-0 rounded-tl-md bg-black/45 p-0.5">
        <Maximize2 className="size-2.5 text-white" />
      </span>
    </button>
  )
}

/**
 * Manual workout logger (centered modal) — mainly for gym sessions the watch
 * didn't record. Watch activities (incl. strength) sync in from Garmin.
 */
function LogWorkoutSheet({ open, onOpenChange, onLogged }) {
  const [name, setName] = useState('')
  const [date, setDate] = useState(() => new Date().toLocaleDateString('sv-SE')) // YYYY-MM-DD, local
  const [exercises, setExercises] = useState([]) // [{ key, name, hasGif, reps: ['10', …], restS }]
  const [query, setQuery] = useState('')
  const [equip, setEquip] = useState('all')
  const [focused, setFocused] = useState(false)
  const [preview, setPreview] = useState(null) // { slug, name } enlarged in an overlay
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const searchRef = useRef(null)
  const { data: library } = useApi(() => api.exerciseLibrary(), [], [], 'exercise-library')

  // Word-based matching so "shoulder press machine" also finds
  // "Machine Shoulder Press".
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  // Keep the suggestions open while a preview overlay is up, so closing the
  // preview drops you back into the same list.
  const suggestionsOpen = (focused || preview) && (words.length > 0 || equip !== 'all')
  const results = suggestionsOpen
    ? (library || [])
        .filter((e) => {
          const name = e.name.toLowerCase()
          return words.every((w) => name.includes(w)) &&
            (equip === 'all' || e.equipment.includes(equip))
        })
        .slice(0, 30)
    : []

  function addExercise(e) {
    // Stable per-row identity — the same exercise can be added twice, and rows
    // keyed by index would hand their ExerciseGif state to a neighbour on removal.
    const uid = crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
    setExercises((xs) => [...xs, { uid, key: e.slug, name: e.name, hasGif: e.hasGif, reps: ['', '', ''], restS: '' }])
    setQuery('')
  }

  function updateExercise(i, patch) {
    setExercises((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  }

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      // No duration/calories/HR inputs — the backend estimates duration from
      // the logged sets and rest times.
      await api.logWorkout({
        sport: 'strength',
        name,
        date,
        exercises: exercises
          .map((ex) => ({
            key: ex.key,
            restS: Number(ex.restS) || 0,
            reps: ex.reps.map((r) => Number(r)).filter((n) => Number.isFinite(n) && n > 0),
          }))
          .filter((ex) => ex.reps.length > 0),
      })
      setName('')
      setExercises([])
      setQuery('')
      setEquip('all')
      setPreview(null)
      onOpenChange(false)
      onLogged?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setPreview(null) // don't reopen onto a stale overlay
        onOpenChange(next)
      }}
    >
      <DialogContent className="gap-0">
        <DialogHeader className="pr-10">
          <DialogTitle className="flex items-center gap-2">
            <Dumbbell className="size-4 text-[var(--neon)]" />
            Log a workout
          </DialogTitle>
          <DialogDescription className="text-xs">
            Pick your machines & exercises and log reps per set — the muscle recovery map updates automatically.
          </DialogDescription>
        </DialogHeader>

        {/* One scroll area with its scrollbar hidden; the submit row stays put underneath. */}
        <form
          id="log-workout-form"
          className="no-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4"
          onSubmit={submit}
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name (optional)">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Push day"
                maxLength={80}
              />
            </Field>
            <Field label="Date">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </Field>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-muted-foreground text-[11px] font-medium">
              Machines & exercises — reps per set & rest
            </span>

            <div className="relative">
              <Search className="text-muted-foreground pointer-events-none absolute top-2 left-2.5 size-4" />
              <Input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder="Search machines & exercises…"
                aria-label="Search machines and exercises"
                style={{ paddingLeft: '2rem' }} // the Input's own px sets padding-inline, which beats a pl-* class
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {EQUIP_FILTERS.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setEquip(value)
                    searchRef.current?.focus()
                  }}
                  className={`rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors ${
                    equip === value
                      ? 'border-[var(--neon)]/40 bg-[var(--neon)]/10 text-[var(--neon)]'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* In flow rather than floating: a dropdown would be clipped by the scroll area. */}
            {suggestionsOpen && (
              <div className="border-border/70 bg-popover rounded-lg border shadow-lg">
                {results.map((e) => (
                  <div
                    key={e.slug}
                    className="hover:bg-muted/50 border-border/40 flex w-full items-center gap-2.5 border-b p-2 last:border-b-0"
                  >
                    <ExerciseGif
                      slug={e.slug}
                      hasGif={e.hasGif}
                      onPreview={() => setPreview({ slug: e.slug, name: e.name })}
                      className="size-10"
                    />
                    <button
                      type="button"
                      onMouseDown={(ev) => ev.preventDefault()}
                      onClick={() => addExercise(e)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-xs font-medium">{e.name}</p>
                      <p className="text-muted-foreground truncate text-[10px]">{e.muscles.join(' · ')}</p>
                    </button>
                  </div>
                ))}
                {results.length === 0 && (
                  <p className="text-muted-foreground p-3 text-center text-xs">
                    {library ? 'No exercises match your search.' : 'Loading exercise library…'}
                  </p>
                )}
              </div>
            )}

            {exercises.map((ex, i) => (
              <div key={ex.uid} className="border-border/70 rounded-lg border p-2.5">
                <div className="flex items-center gap-2.5">
                  <ExerciseGif
                    slug={ex.key}
                    hasGif={ex.hasGif}
                    onPreview={() => setPreview({ slug: ex.key, name: ex.name })}
                    className="size-12"
                  />
                  <p className="min-w-0 flex-1 truncate text-xs font-semibold">{ex.name}</p>
                  <button
                    type="button"
                    aria-label="Remove exercise"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setExercises((xs) => xs.filter((_, j) => j !== i))}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap items-end gap-1.5">
                  {ex.reps.map((r, si) => (
                    <label key={si} className="flex flex-col items-center gap-0.5">
                      <span className="text-muted-foreground text-[9px]">Set {si + 1}</span>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min="1"
                        max="200"
                        value={r}
                        placeholder="10"
                        className="h-8 w-12 px-1 text-center text-xs [appearance:textfield] [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden"
                        onChange={(e) =>
                          updateExercise(i, { reps: ex.reps.map((rr, k) => (k === si ? e.target.value : rr)) })
                        }
                      />
                    </label>
                  ))}
                  <div className="flex gap-1 pb-0.5">
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="size-7"
                      aria-label="Add a set"
                      onClick={() => updateExercise(i, { reps: [...ex.reps, ''] })}
                    >
                      <Plus className="size-3.5" />
                    </Button>
                    {ex.reps.length > 1 && (
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="size-7"
                        aria-label="Remove last set"
                        onClick={() => updateExercise(i, { reps: ex.reps.slice(0, -1) })}
                      >
                        <Minus className="size-3.5" />
                      </Button>
                    )}
                  </div>
                  <label className="ml-auto flex flex-col items-center gap-0.5">
                    <span className="text-muted-foreground text-[9px]">Rest (s)</span>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      max="3600"
                      value={ex.restS}
                      placeholder="90"
                      className="h-8 w-14 px-1 text-center text-xs [appearance:textfield] [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden"
                      onChange={(e) => updateExercise(i, { restS: e.target.value })}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </form>

        <div className="border-t p-4">
          {error && <p className="text-destructive mb-2 text-xs" role="alert">{error}</p>}
          <Button type="submit" form="log-workout-form" disabled={busy || exercises.length === 0} className="w-full">
            {busy ? <Loader2 className="size-4 animate-spin" /> : 'Log workout'}
          </Button>
        </div>
      </DialogContent>

      {/* Enlarged demo GIF as a nested dialog — Radix stacks it above the
          logger and handles focus trapping, Escape and focus restoration. */}
      {preview && (
        <Dialog open onOpenChange={(next) => { if (!next) setPreview(null) }}>
          <DialogContent className="w-[min(94vw,24rem)] gap-1 rounded-xl bg-white p-3 text-neutral-900">
            <img
              src={api.exerciseGifUrl(preview.slug)}
              alt={`${preview.name} demo`}
              className="aspect-square w-full object-contain"
            />
            <DialogTitle className="mt-1 text-center text-sm font-medium text-neutral-900">
              {preview.name}
            </DialogTitle>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  )
}

function StreakCard({ s }) {

  return (
    <Card size="sm">
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="bg-[var(--neon)]/10 text-[var(--neon)] flex size-8 items-center justify-center rounded-lg">
            <Flame className="size-4" />
          </div>
          <Badge variant="outline" className="text-[10px]">
            longest {s.longestStreakWeeks} wks
          </Badge>
        </div>
        <div>
          <p className="text-xl font-bold tracking-tight tabular-nums">
            {s.streakWeeks}
            <span className="text-muted-foreground ml-1 text-xs font-medium">week streak</span>
          </p>
          <p className="text-muted-foreground text-[11px]">Running at least once per week</p>
        </div>
        <div className="flex items-center gap-1.5 pt-1">
          {s.weekDays.map((d, i) => (
            <span
              key={i}
              title={`${d.day}${d.ran ? ' — ran' : ''}`}
              className={`flex size-5 items-center justify-center rounded-full text-[9px] font-semibold ${
                d.ran
                  ? 'bg-[var(--neon)] text-white'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {d.day}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function WeekGoalCard({ s }) {
  const { settings } = useSettings()
  const goalKm = settings.weeklyDistanceGoal || s.weeklyGoalKm || 25
  const percent = Math.min(Math.round((s.thisWeekKm / goalKm) * 100), 100)

  return (
    <Card size="sm">
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="bg-muted text-muted-foreground flex size-8 items-center justify-center rounded-lg">
            <Target className="size-4" />
          </div>
          <Badge variant="outline" className="text-[10px]">{percent}% of goal</Badge>
        </div>
        <div>
          <p className="text-xl font-bold tracking-tight tabular-nums">
            {s.thisWeekKm}
            <span className="text-muted-foreground text-xs font-medium">
              {' '}
              / {goalKm} km
            </span>
          </p>
          <p className="text-muted-foreground text-[11px]">This week · {Math.max(0, goalKm - s.thisWeekKm).toFixed(1)} km to go</p>
        </div>
        <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
          <div className="h-full rounded-full bg-[var(--neon)]" style={{ width: `${percent}%` }} />
        </div>
      </CardContent>
    </Card>
  )
}

export default function Workouts() {
  const { settings } = useSettings()
  const { data, refetch } = useApi(() => api.workouts(), [], ['activity', 'sync'], 'workouts')
  const [logOpen, setLogOpen] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  async function removeWorkout(id) {
    if (!window.confirm('Delete this logged workout?')) return
    setDeleteError('')
    try {
      await api.deleteActivity(id)
      refetch()
    } catch (err) {
      setDeleteError(err.message) // the next SSE refresh still reconciles the list
    }
  }

  if (!data) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-6">
        <Skeleton className="h-7 w-full max-w-sm" />
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-56" />
      </div>
    )
  }

  const { workouts, weeklyDistance, paceTrend, personalRecords, runningStats } = data
  const goalKm = settings.weeklyDistanceGoal || runningStats.weeklyGoalKm || 25

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-6">
      <header className="flex items-center justify-between">
        <h1 className="page-title text-xl md:text-2xl">Workouts</h1>
        <Button size="sm" className="gap-1.5" onClick={() => setLogOpen(true)}>
          <Plus className="size-4" />
          Log workout
        </Button>
      </header>
      <LogWorkoutSheet open={logOpen} onOpenChange={setLogOpen} onLogged={refetch} />
      {deleteError && (
        <p className="text-destructive text-[10px]" role="alert">Delete failed: {deleteError}</p>
      )}

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StreakCard s={runningStats} />
        <WeekGoalCard s={runningStats} />
        <Card size="sm">
          <CardContent className="space-y-2">
            <div className="bg-muted text-muted-foreground flex size-8 items-center justify-center rounded-lg">
              <Route className="size-4" />
            </div>
            <div>
              <p className="text-xl font-bold tracking-tight tabular-nums">
                {runningStats.totalKm.toLocaleString()}
                <span className="text-muted-foreground ml-1 text-xs font-medium">km</span>
              </p>
              <p className="text-muted-foreground text-[11px]">All-time distance</p>
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="space-y-2">
            <div className="bg-muted text-muted-foreground flex size-8 items-center justify-center rounded-lg">
              <Timer className="size-4" />
            </div>
            <div>
              <p className="text-xl font-bold tracking-tight tabular-nums">
                {runningStats.avgPace}
                <span className="text-muted-foreground ml-1 text-xs font-medium">/km</span>
              </p>
              <p className="text-muted-foreground text-[11px]">Average pace · all runs</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <MuscleRecoveryCard />
        <div className="flex min-h-0 flex-col gap-3">
        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <Footprints className="size-4 text-[var(--neon)]" />
              Weekly distance
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="text-[10px]">goal {goalKm} km</Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            <ChartContainer config={distanceConfig} className="h-[180px] w-full">
              <BarChart accessibilityLayer data={weeklyDistance} margin={{ left: 12, right: 12 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                <ChartTooltip content={<ChartTooltipContent unit=" km" hideLabel />} />
                <ReferenceLine
                  y={goalKm}
                  stroke="var(--muted-foreground)"
                  strokeDasharray="4 4"
                />
                <Bar dataKey="km" fill="var(--color-km)" radius={[5, 5, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <TrendingUp className="size-4 text-[var(--neon)]" />
              Pace trend
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="text-[10px]">min/km · lower is better</Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            <ChartContainer config={paceConfig} className="h-[180px] w-full">
              <LineChart accessibilityLayer data={paceTrend} margin={{ left: 12, right: 12 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis domain={['dataMin - 0.1', 'dataMax + 0.1']} hide />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      hideLabel
                      formatter={(value) => (
                        <div className="flex w-full items-center justify-between gap-4">
                          <span className="text-muted-foreground">Avg pace</span>
                          <span className="font-mono font-medium tabular-nums">
                            {fmtPace(value)} /km
                          </span>
                        </div>
                      )}
                    />
                  }
                />
                <Line
                  dataKey="pace"
                  type="monotone"
                  stroke="var(--color-pace)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
        </div>
      </section>

      {personalRecords.length > 0 && (
      <section>
        <h2 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
          Personal records
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {personalRecords.map((pr) => (
            <Card size="sm" key={pr.label}>
              <CardContent className="flex items-center gap-3">
                <div className="bg-amber-500/10 text-amber-600 dark:text-amber-400 flex size-9 shrink-0 items-center justify-center rounded-lg">
                  <Trophy className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold tabular-nums">{pr.value}</p>
                  <p className="text-muted-foreground truncate text-[11px]">
                    {pr.label} · {pr.date}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      )}


      <section>
        <h2 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
          Recent activities
        </h2>
        {workouts.length === 0 && (
          <EmptyState
            icon={Dumbbell}
            title="No activities yet"
            description="Connect Garmin in Settings and your workouts stream in automatically — or log a gym session yourself."
          />
        )}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {workouts.map((w) => {
            const SportIcon = SPORT_ICONS[w.sport] || Activity
            return (
            <Card key={w.id} size="sm">
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
                      <SportIcon className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{w.type}</p>
                      <p className="text-muted-foreground text-[11px]">
                        {w.date}
                        {w.provider === 'manual' && ' · logged manually'}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Badge variant="outline">{w.distance > 0 ? `${w.distance} km` : w.duration}</Badge>
                    {w.provider === 'manual' && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive size-6"
                        aria-label="Delete workout"
                        onClick={() => removeWorkout(w.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="text-muted-foreground grid grid-cols-3 gap-2 text-xs">
                  <span className="flex items-center gap-1.5">
                    <Timer className="size-3.5" /> {w.duration}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Flame className="size-3.5 text-[var(--neon)]" /> {w.calories} kcal
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Activity className="size-3.5 text-rose-500" /> {w.hr ?? '—'} bpm
                  </span>
                </div>
              </CardContent>
            </Card>
            )
          })}
        </div>
      </section>
    </div>
  )
}
