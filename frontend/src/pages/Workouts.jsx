import {
  Activity,
  Flame,
  Footprints,
  Route,
  Target,
  Timer,
  TrendingUp,
  Trophy,
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
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
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
  const { data } = useApi(() => api.workouts(), [], ['activity', 'sync'])

  if (!data) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-6">
        <Skeleton className="h-10 w-full max-w-sm" />
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
      <header>
        <h1 className="page-title text-xl md:text-2xl">Workouts</h1>
      </header>

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
          <p className="text-muted-foreground text-xs">
            No activities yet — connect Garmin in Settings and your workouts will stream in automatically.
          </p>
        )}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {workouts.map((w) => (
            <Card key={w.id} size="sm">
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="bg-muted text-muted-foreground flex size-8 items-center justify-center rounded-lg">
                      <Footprints className="size-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{w.type}</p>
                      <p className="text-muted-foreground text-[11px]">{w.date}</p>
                    </div>
                  </div>
                  <Badge variant="outline">{w.distance} km</Badge>
                </div>
                <div className="text-muted-foreground grid grid-cols-3 gap-2 text-xs">
                  <span className="flex items-center gap-1.5">
                    <Timer className="size-3.5" /> {w.duration}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Flame className="size-3.5 text-[var(--neon)]" /> {w.calories} kcal
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Activity className="size-3.5 text-rose-500" /> {w.hr} bpm
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
