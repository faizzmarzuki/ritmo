import { useState } from 'react'
import {
  BedDouble,
  Circle,
  CircleCheck,
  CigaretteOff,
  Droplets,
  Flag,
  Flame,
  GlassWater,
  Plus,
  Scale,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import EmptyState from '@/components/EmptyState'
import { api } from '@/lib/api'
import { useApi } from '@/hooks/useApi'
import { useSettings } from '@/context/SettingsContext'

const GLASS_ML = 250

const MILESTONES = [
  { label: 'Heart rate & blood pressure normalize', at: '24 hours', days: 1 },
  { label: 'Lungs recovering, breathing easier', at: '72 hours', days: 3 },
  { label: 'Taste & smell sharpen', at: '2 weeks', days: 14 },
  { label: 'Circulation & lung function improve', at: '3 months', days: 90 },
  { label: 'Coughing & shortness of breath decrease', at: '9 months', days: 270 },
  { label: 'Heart disease risk cut in half', at: '1 year', days: 365 },
]

const weightConfig = {
  kg: { label: 'Weight', color: 'var(--neon)' },
}

const hydrationConfig = {
  ml: { label: 'Water', color: 'var(--neon)' },
}

function WeightCard({ stats }) {
  const { settings } = useSettings()
  const currentWeight = stats.currentWeight
  const heightCm = settings.heightCm || stats.heightCm || 178
  const startWeight = settings.startWeight || stats.startWeight || currentWeight
  const goalWeight = settings.goalWeight || stats.goalWeight

  if (currentWeight == null) {
    return (
      <Card size="sm">
        <CardContent>
          <EmptyState
            size="sm"
            icon={Scale}
            title="No weight logged yet"
            description="Add your first entry below, or sync a smart scale through Garmin."
          />
        </CardContent>
      </Card>
    )
  }

  const lost = (startWeight - currentWeight).toFixed(1)
  const totalToLose = goalWeight ? startWeight - goalWeight : 0
  const percent = totalToLose > 0
    ? Math.max(0, Math.min(100, Math.round(((startWeight - currentWeight) / totalToLose) * 100)))
    : 0
  const bmi = (currentWeight / (heightCm / 100) ** 2).toFixed(1)

  return (
    <Card size="sm">
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="bg-[var(--neon)]/10 text-[var(--neon)] flex size-8 items-center justify-center rounded-lg">
            <Scale className="size-4" />
          </div>
          <Badge variant="outline" className="border-transparent bg-[var(--neon)]/10 text-[var(--neon)]">
            -{lost} kg
          </Badge>
        </div>
        <div>
          <p className="text-xl font-bold tracking-tight tabular-nums">
            {currentWeight}
            <span className="text-muted-foreground ml-1 text-xs font-medium">kg now</span>
          </p>
          <p className="text-muted-foreground text-[11px]">
            Started at {startWeight} kg{goalWeight ? ` · goal ${goalWeight} kg` : ''}
          </p>
        </div>
        <div className="space-y-1">
          <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
            <div className="h-full rounded-full bg-[var(--neon)]" style={{ width: `${percent}%` }} />
          </div>
          <p className="text-muted-foreground text-[10px]">
            {goalWeight ? `${percent}% to goal · ` : ''}BMI {bmi}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function HydrationCard({ waterMl, onAddGlass }) {
  const { settings } = useSettings()
  const goalMl = settings.waterGoalMl || 2500
  const percent = Math.min(Math.round((waterMl / goalMl) * 100), 100)
  const glasses = (waterMl / GLASS_ML).toFixed(1)

  return (
    <Card size="sm">
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="bg-[var(--neon)]/10 flex size-8 items-center justify-center rounded-lg text-[var(--neon)]">
            <Droplets className="size-4" />
          </div>
          <Badge variant="outline" className="text-[10px]">
            {glasses} / {(goalMl / GLASS_ML).toFixed(0)} glasses
          </Badge>
        </div>
        <div>
          <p className="text-xl font-bold tracking-tight tabular-nums">
            {(waterMl / 1000).toFixed(2)}
            <span className="text-muted-foreground ml-1 text-xs font-medium">
              / {(goalMl / 1000).toFixed(1)} L today
            </span>
          </p>
          <p className="text-muted-foreground text-[11px]">
            {waterMl >= goalMl ? 'Goal reached — nice!' : `${((goalMl - waterMl) / 1000).toFixed(2)} L to go`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
            <div className="h-full rounded-full bg-[var(--neon)] transition-all" style={{ width: `${percent}%` }} />
          </div>
          <Button size="sm" variant="outline" className="h-6 gap-1 px-2 text-[10px]" onClick={onAddGlass}>
            <Plus className="size-3" />
            Glass
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function SmokeFreeCard() {
  const { settings } = useSettings()
  const quitDate = settings.quitDate

  if (!quitDate) {
    return (
      <Card size="sm">
        <CardContent className="space-y-2">
          <div className="bg-[var(--neon)]/10 text-[var(--neon)] flex size-8 items-center justify-center rounded-lg">
            <CigaretteOff className="size-4" />
          </div>
          <p className="text-muted-foreground text-xs">
            Set your quit date in Settings to track your smoke-free streak and savings.
          </p>
        </CardContent>
      </Card>
    )
  }

  const daysSmokeFree = Math.max(
    0,
    Math.floor((Date.now() - new Date(quitDate).getTime()) / 86400000),
  )
  const avoided = daysSmokeFree * (settings.cigarettesPerDay || 15)
  const saved = Math.round(avoided * (settings.costPerCigarette || 0.6))
  const yearPercent = Math.min(Math.round((daysSmokeFree / 365) * 100), 100)
  const quitLabel = new Date(quitDate).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <Card size="sm">
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="bg-[var(--neon)]/10 text-[var(--neon)] flex size-8 items-center justify-center rounded-lg">
            <CigaretteOff className="size-4" />
          </div>
          <Badge variant="outline" className="text-[10px]">since {quitLabel}</Badge>
        </div>
        <div>
          <p className="text-xl font-bold tracking-tight tabular-nums">
            {daysSmokeFree}
            <span className="text-muted-foreground ml-1 text-xs font-medium">days smoke-free</span>
          </p>
          <p className="text-muted-foreground text-[11px]">
            {avoided.toLocaleString()} cigarettes avoided · ${saved.toLocaleString()} saved
          </p>
        </div>
        <div className="space-y-1">
          <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
            <div className="h-full rounded-full bg-[var(--neon)]" style={{ width: `${yearPercent}%` }} />
          </div>
          <p className="text-muted-foreground text-[10px]">
            {yearPercent}% of the way to 1 year smoke-free
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function GoalsSummaryCard({ goals }) {
  const done = goals.filter((g) => g.doneToday).length
  const total = Math.max(goals.length, 1)

  return (
    <Card size="sm">
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="bg-amber-500/10 text-amber-600 dark:text-amber-400 flex size-8 items-center justify-center rounded-lg">
            <Flag className="size-4" />
          </div>
          <Badge variant="outline" className="text-[10px]">{done} / {goals.length} done</Badge>
        </div>
        <div>
          <p className="text-xl font-bold tracking-tight tabular-nums">
            {Math.round((done / total) * 100)}%
            <span className="text-muted-foreground ml-1 text-xs font-medium">of daily goals</span>
          </p>
          <p className="text-muted-foreground text-[11px]">
            {done === goals.length ? 'All goals complete — perfect day!' : `${goals.length - done} goals left today`}
          </p>
        </div>
        <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
          <div
            className="h-full rounded-full bg-amber-500 transition-all"
            style={{ width: `${(done / total) * 100}%` }}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function GoalsChecklist({ goals, onToggle }) {
  const done = goals.filter((g) => g.doneToday).length

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-sm">Daily goals</CardTitle>
        <CardAction>
          <Badge variant="outline" className="border-transparent bg-amber-500/10 text-amber-600 dark:text-amber-400">
            {done} / {goals.length} today
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {goals.map((goal) => (
          <button
            key={goal.id}
            type="button"
            disabled={goal.auto}
            onClick={() => !goal.auto && onToggle(goal.id)}
            title={goal.auto ? 'Tracked automatically from your data' : 'Tap to toggle'}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
              goal.auto ? 'cursor-default' : 'hover:bg-muted/70 cursor-pointer'
            } ${goal.doneToday ? 'bg-[var(--neon)]/5' : 'bg-muted/40'}`}
          >
            {goal.doneToday ? (
              <CircleCheck className="size-5 shrink-0 text-[var(--neon)]" />
            ) : (
              <Circle className="text-muted-foreground size-5 shrink-0" />
            )}
            <span className="min-w-0 flex-1">
              <span
                className={`block text-sm font-medium ${
                  goal.doneToday ? 'text-muted-foreground line-through' : ''
                }`}
              >
                {goal.label}
              </span>
              {goal.detail && (
                <span className="text-muted-foreground block truncate text-[10px]">{goal.detail}</span>
              )}
            </span>
            {goal.auto && (
              <Badge variant="outline" className="text-muted-foreground shrink-0 text-[9px]">auto</Badge>
            )}
            <Badge variant="outline" className="shrink-0 border-transparent bg-[var(--neon)]/10 text-[var(--neon)]">
              <Flame data-icon="inline-start" />
              {goal.streak}d
            </Badge>
          </button>
        ))}
      </CardContent>
    </Card>
  )
}

export default function Progress({ embedded = false }) {
  const { settings } = useSettings()
  const [newWeight, setNewWeight] = useState('')
  const { data, refetch } = useApi(() => api.progress(), [], ['weight', 'hydration', 'goals', 'sync', 'nutrition', 'sleep', 'daily'], 'progress')

  const wrapClass = embedded ? 'space-y-4' : 'mx-auto w-full max-w-6xl space-y-4 p-4 md:p-6'
  if (!data) {
    return (
      <div className={wrapClass}>
        <Skeleton className="h-10 w-full max-w-sm" />
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-56" />
      </div>
    )
  }

  const { weightSeries, progressStats, hydration, dailyGoals: goals, sleepDebt, smokeFree } = data
  const waterMl = hydration.todayMl

  async function addGlass() {
    await api.addHydration(GLASS_ML)
    refetch()
  }

  async function toggleGoal(id) {
    const goal = goals.find((g) => g.id === id)
    await api.logGoal(id, !goal?.doneToday)
    refetch()
  }

  async function logWeight(e) {
    e.preventDefault()
    const kg = Number(newWeight)
    if (!kg) return
    await api.addWeight(kg)
    setNewWeight('')
    refetch()
  }

  return (
    <div className={wrapClass}>
      {!embedded && (
        <header>
          <h1 className="page-title text-xl md:text-2xl">Progress</h1>
        </header>
      )}

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <WeightCard stats={progressStats} />
        <HydrationCard waterMl={waterMl} onAddGlass={addGlass} />
        <SmokeFreeCard />
        <GoalsSummaryCard goals={goals} />
      </section>

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <Scale className="size-4 text-[var(--neon)]" />
              Weight journey
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="text-[10px]">
                {progressStats.currentWeight != null
                  ? `${settings.startWeight || progressStats.startWeight} → ${progressStats.currentWeight} kg`
                  : 'no data yet'}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-3">
            <form onSubmit={logWeight} className="flex items-center gap-2">
              <Input
                type="number"
                step="0.1"
                min="20"
                max="400"
                placeholder="Log today's weight (kg)"
                value={newWeight}
                onChange={(e) => setNewWeight(e.target.value)}
                className="h-8 max-w-[220px] text-xs"
              />
              <Button type="submit" size="sm" variant="outline" className="h-8">
                <Plus data-icon="inline-start" />
                Log
              </Button>
            </form>
            <ChartContainer config={weightConfig} className="h-[200px] w-full">
              <LineChart accessibilityLayer data={weightSeries} margin={{ left: 12, right: 12 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} />
                <YAxis domain={['dataMin - 1', 'dataMax + 1']} hide />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      formatter={(value) => (
                        <div className="flex w-full items-center justify-between gap-4">
                          <span className="text-muted-foreground">Weight</span>
                          <span className="font-mono font-medium tabular-nums">{value} kg</span>
                        </div>
                      )}
                    />
                  }
                />
                <Line
                  dataKey="kg"
                  type="monotone"
                  stroke="var(--color-kg)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <GlassWater className="size-4 text-[var(--neon)]" />
              Hydration this week
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="text-[10px]">
                goal {((settings.waterGoalMl || hydration.goalMl) / 1000).toFixed(1)} L / day
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            <ChartContainer config={hydrationConfig} className="h-[200px] w-full">
              <BarChart accessibilityLayer data={hydration.week} margin={{ left: 12, right: 12 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis domain={[0, 'dataMax + 400']} hide />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      hideLabel
                      formatter={(value) => (
                        <div className="flex w-full items-center justify-between gap-4">
                          <span className="text-muted-foreground">Intake</span>
                          <span className="font-mono font-medium tabular-nums">
                            {(value / 1000).toFixed(2)} L
                          </span>
                        </div>
                      )}
                    />
                  }
                />
                <Bar dataKey="ml" fill="var(--color-ml)" radius={[5, 5, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <GoalsChecklist goals={goals} onToggle={toggleGoal} />
        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <BedDouble className="size-4 text-[var(--neon)]" />
              Sleep debt
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="text-[10px]">target {sleepDebt?.targetHours ?? 8}h / night</Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            {sleepDebt ? (
              <div className="flex items-center gap-4">
                <div>
                  <p className={`text-3xl font-bold tabular-nums ${sleepDebt.hours > 4 ? 'text-destructive' : sleepDebt.hours > 0 ? 'text-amber-500' : 'text-[var(--neon)]'}`}>
                    {sleepDebt.hours}h
                  </p>
                  <p className="text-muted-foreground text-[11px]">owed over last {sleepDebt.nights} night{sleepDebt.nights === 1 ? '' : 's'}</p>
                </div>
                <div className="text-muted-foreground flex-1 text-xs">
                  Averaging <span className="text-foreground font-semibold">{sleepDebt.avgHours}h</span> per night from
                  your Garmin sleep data. {sleepDebt.hours > 0
                    ? 'Going to bed 30–60 min earlier this week would clear it.'
                    : 'No debt — keep it up.'}
                </div>
              </div>
            ) : (
              <EmptyState
                size="sm"
                icon={BedDouble}
                title="No sleep data yet"
                description="Connect Garmin in Settings to track your sleep debt."
              />
            )}
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <CigaretteOff className="size-4 text-[var(--neon)]" />
              Smoke-free milestones
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {MILESTONES.map((m) => ({ ...m, done: (smokeFree?.daysSmokeFree ?? 0) >= m.days })).map((m) => (
              <div
                key={m.at}
                className={`flex items-center justify-between rounded-md px-3 py-2 text-xs ${
                  m.done ? 'bg-[var(--neon)]/5' : 'bg-muted/40'
                }`}
              >
                <span className={m.done ? 'text-muted-foreground' : 'font-medium'}>
                  {m.label}
                </span>
                <Badge
                  variant="outline"
                  className={
                    m.done
                      ? 'border-transparent bg-[var(--neon)]/10 text-[var(--neon)]'
                      : ''
                  }
                >
                  {m.at}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
