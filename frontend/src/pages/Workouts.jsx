import { useState } from 'react'
import {
  Activity,
  Bike,
  Dumbbell,
  Flame,
  Footprints,
  Loader2,
  Plus,
  Route,
  Target,
  Timer,
  Trash2,
  TrendingUp,
  Trophy,
  Waves,
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import EmptyState from '@/components/EmptyState'
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
const DISTANCE_SPORTS = new Set(['run', 'walk', 'ride', 'swim'])

const SPORT_OPTIONS = [
  { value: 'strength', label: 'Gym / Strength' },
  { value: 'run', label: 'Run' },
  { value: 'walk', label: 'Walk' },
  { value: 'ride', label: 'Ride' },
  { value: 'swim', label: 'Swim' },
  { value: 'other', label: 'Other' },
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
 * Manual workout logger (bottom sheet) — mainly for gym sessions the watch
 * didn't record. Watch activities (incl. strength) sync in from Garmin.
 */
function LogWorkoutSheet({ open, onOpenChange, onLogged }) {
  const [sport, setSport] = useState('strength')
  const [name, setName] = useState('')
  const [date, setDate] = useState(() => new Date().toLocaleDateString('sv-SE')) // YYYY-MM-DD, local
  const [durationMin, setDurationMin] = useState('')
  const [distanceKm, setDistanceKm] = useState('')
  const [calories, setCalories] = useState('')
  const [avgHr, setAvgHr] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.logWorkout({
        sport,
        name,
        date,
        durationMin: Number(durationMin),
        distanceKm: DISTANCE_SPORTS.has(sport) ? Number(distanceKm) || 0 : 0,
        calories: Number(calories) || 0,
        avgHr: Number(avgHr) || 0,
      })
      setName('')
      setDurationMin('')
      setDistanceKm('')
      setCalories('')
      setAvgHr('')
      onOpenChange(false)
      onLogged?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto w-full rounded-t-2xl pb-[calc(1rem+env(safe-area-inset-bottom))] md:max-w-md"
      >
        <SheetHeader className="pb-0">
          <SheetTitle className="flex items-center gap-2">
            <Dumbbell className="size-4 text-[var(--neon)]" />
            Log a workout
          </SheetTitle>
          <SheetDescription className="text-xs">
            Workouts recorded on your Garmin watch sync in automatically — log the rest here.
          </SheetDescription>
        </SheetHeader>

        <form className="flex flex-col gap-3 px-4" onSubmit={submit}>
          <div className="flex flex-wrap gap-1.5">
            {SPORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSport(opt.value)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  sport === opt.value
                    ? 'border-[var(--neon)]/40 bg-[var(--neon)]/10 text-[var(--neon)]'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <Field label="Name (optional)">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={sport === 'strength' ? 'e.g. Push day — chest & triceps' : 'e.g. Easy evening session'}
              maxLength={80}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </Field>
            <Field label="Duration (min)">
              <Input
                type="number"
                inputMode="numeric"
                min="1"
                max="1440"
                value={durationMin}
                onChange={(e) => setDurationMin(e.target.value)}
                placeholder="45"
                required
              />
            </Field>
            {DISTANCE_SPORTS.has(sport) && (
              <Field label="Distance (km)">
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={distanceKm}
                  onChange={(e) => setDistanceKm(e.target.value)}
                  placeholder="5.0"
                />
              </Field>
            )}
            <Field label="Calories (optional)">
              <Input
                type="number"
                inputMode="numeric"
                min="0"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                placeholder="300"
              />
            </Field>
            <Field label="Avg HR (optional)">
              <Input
                type="number"
                inputMode="numeric"
                min="25"
                max="250"
                value={avgHr}
                onChange={(e) => setAvgHr(e.target.value)}
                placeholder="120"
              />
            </Field>
          </div>

          {error && <p className="text-destructive text-xs" role="alert">{error}</p>}

          <Button type="submit" disabled={busy || !durationMin} className="w-full">
            {busy ? <Loader2 className="size-4 animate-spin" /> : 'Log workout'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
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

  async function removeWorkout(id) {
    if (!window.confirm('Delete this logged workout?')) return
    try {
      await api.deleteActivity(id)
      refetch()
    } catch {
      /* the next SSE refresh will reconcile */
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
