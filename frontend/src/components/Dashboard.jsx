import { useState } from 'react'
import {
  Activity,
  BedDouble,
  Bluetooth,
  BluetoothOff,
  BatteryCharging,
  Flame,
  Footprints,
  Gauge,
  HeartPulse,
  Scale,
  UtensilsCrossed,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import StatCard from '@/components/StatCard'
import { Skeleton } from '@/components/ui/skeleton'
import EmptyState from '@/components/EmptyState'
import { api } from '@/lib/api'
import { useApi } from '@/hooks/useApi'
import { useBluetoothHr, useLiveBpm } from '@/hooks/useLiveHeartRate'
import { Button } from '@/components/ui/button'
const PERIODS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
]

const hrConfig = {
  bpm: { label: 'Heart Rate', color: '#f43f5e' },
}

const intakeConfig = {
  kcal: { label: 'Calories', color: 'var(--neon)' },
}

const sleepConfig = {
  deep: { label: 'Deep', color: '#15803d' },
  rem: { label: 'REM', color: 'var(--neon)' },
  light: { label: 'Light', color: '#86efac' },
  awake: { label: 'Awake', color: '#94a3b8' },
}

const vo2Config = {
  vo2: { label: 'VO₂ Max', color: 'var(--neon)' },
}

const batteryConfig = {
  battery: { label: 'Body Battery', color: 'var(--neon)' },
  stress: { label: 'Stress Level', color: '#f43f5e' },
  rest: { label: 'Rest Mode', color: '#64748b' },
}

const batteryStatusStyles = {
  Energized:
    'border-transparent bg-[var(--neon)]/10 text-[var(--neon)]',
  Balanced: 'border-transparent bg-slate-500/10 text-slate-400',
  Strained: 'border-transparent bg-red-500/10 text-red-600 dark:text-red-400',
}

function NoDataCard({ icon: Icon, title, hint }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-muted-foreground flex items-center gap-1.5 text-sm">
          <Icon className="size-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <EmptyState
          size="sm"
          title="No data yet"
          description={hint ?? 'Connect Garmin in Settings and this fills in automatically.'}
        />
      </CardContent>
    </Card>
  )
}

function CardTitleWithIcon({ icon: Icon, className, children }) {
  return (
    <CardTitle className={`flex items-center gap-1.5 text-sm ${className ?? ''}`}>
      <Icon className="size-4" />
      {children}
    </CardTitle>
  )
}

function HeartRateCard({ data }) {
  const { current, resting, max, zone } = data.hrSummary ?? {}
  const { bpm: liveBpm, live, setLocal } = useLiveBpm()
  const ble = useBluetoothHr((bpm) => setLocal(bpm, true))
  const shown = liveBpm ?? current

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitleWithIcon icon={HeartPulse} className="text-rose-500">
          Heart Rate
          {live && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-rose-500">
              <span className="size-1.5 animate-pulse rounded-full bg-rose-500" />
              LIVE
            </span>
          )}
        </CardTitleWithIcon>
        <CardAction>
          <div className="flex items-center gap-2">
            {ble.supported && (
              <Button
                size="sm"
                variant="outline"
                className="h-6 gap-1 px-2 text-[10px]"
                disabled={ble.status === 'connecting'}
                onClick={ble.status === 'streaming' ? ble.disconnect : ble.connect}
                title={
                  ble.status === 'streaming'
                    ? 'Stop live streaming'
                    : 'Stream live HR from your watch (enable Broadcast Heart Rate on the watch first)'
                }
              >
                {ble.status === 'streaming' ? <BluetoothOff className="size-3" /> : <Bluetooth className="size-3" />}
                {ble.status === 'connecting' ? 'Pairing…' : ble.status === 'streaming' ? 'Stop' : 'Go Live'}
              </Button>
            )}
            <span className="text-xl font-bold tabular-nums">
              {shown ?? '—'}
              <span className="text-muted-foreground ml-0.5 text-xs font-medium">bpm</span>
            </span>
            <Badge variant="outline" className="border-transparent bg-rose-500/10 text-rose-600 dark:text-rose-400">
              peak {max ?? '—'}
            </Badge>
            <Badge variant="outline" className="hidden border-transparent bg-[var(--neon)]/10 text-sky-600 sm:inline-flex dark:text-sky-400">
              rest {resting ?? '—'} · {zone ?? '—'}
            </Badge>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ChartContainer config={hrConfig} className="h-[120px] w-full">
          <AreaChart accessibilityLayer data={data.heartRate} margin={{ left: 12, right: 12 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={12} />
            <YAxis domain={['dataMin - 10', 'dataMax + 10']} hide />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  formatter={(value) => (
                    <div className="flex w-full items-center justify-between gap-4">
                      <span className="text-muted-foreground">Heart rate</span>
                      <span className="font-mono font-medium tabular-nums">
                        {value.toLocaleString()} bpm
                      </span>
                    </div>
                  )}
                />
              }
            />
            <Area
              dataKey="bpm"
              type="monotone"
              stroke="var(--color-bpm)"
              fill="var(--color-bpm)"
              fillOpacity={0.15}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </AreaChart>
        </ChartContainer>
        {ble.error && (
          <p className="text-destructive mt-1 text-[10px]" role="alert">{ble.error}</p>
        )}
      </CardContent>
    </Card>
  )
}

function CalorieIntakeCard({ data }) {
  const avg = Math.round(data.intakeTotal / Math.max(data.calorieIntake.length, 1))

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitleWithIcon icon={UtensilsCrossed} className="text-[var(--neon)]">
          Calorie Intake
        </CardTitleWithIcon>
        <CardAction>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold tabular-nums">
              {data.intakeTotal.toLocaleString()}
              <span className="text-muted-foreground ml-0.5 text-xs font-medium">kcal</span>
            </span>
            <Badge variant="outline" className="border-transparent bg-[var(--neon)]/10 text-[var(--neon)]">
              avg {avg.toLocaleString()}
            </Badge>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ChartContainer config={intakeConfig} className="h-[120px] w-full">
          <BarChart accessibilityLayer data={data.calorieIntake} margin={{ left: 12, right: 12 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={4} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => (
                    <div className="flex w-full items-center justify-between gap-4">
                      <span className="text-muted-foreground">Intake</span>
                      <span className="font-mono font-medium tabular-nums">
                        {value.toLocaleString()} kcal
                      </span>
                    </div>
                  )}
                />
              }
            />
            <Bar dataKey="kcal" fill="var(--color-kcal)" radius={[5, 5, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

function DetailChip({ label, value }) {
  return (
    <div className="bg-muted/60 rounded-md px-2 py-1.5 text-center">
      <p className="text-[11px] leading-none font-medium">{value}</p>
      <p className="text-muted-foreground mt-1 text-[10px] leading-none">{label}</p>
    </div>
  )
}

function SleepCard({ data }) {
  const sleep = data.sleep
  if (!sleep) return <NoDataCard icon={BedDouble} title="Sleep" />
  const lightMin = sleep.totalMin - sleep.deepMin - sleep.remMin - sleep.awakeMin

  const stages = [
    { stage: 'deep', minutes: sleep.deepMin, fill: 'var(--color-deep)' },
    { stage: 'rem', minutes: sleep.remMin, fill: 'var(--color-rem)' },
    { stage: 'light', minutes: lightMin, fill: 'var(--color-light)' },
    { stage: 'awake', minutes: sleep.awakeMin, fill: 'var(--color-awake)' },
  ]

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitleWithIcon icon={BedDouble} className="text-[var(--neon)]">
          Sleep
        </CardTitleWithIcon>
        <CardAction>
          <Badge
            variant="outline"
            className={
              sleep.quality >= 85
                ? 'border-transparent bg-[var(--neon)]/10 text-[var(--neon)]'
                : 'border-transparent bg-amber-500/10 text-amber-600 dark:text-amber-400'
            }
          >
            {sleep.quality ? `quality ${sleep.quality}` : 'no score'}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex items-center gap-3">
        <div className="relative size-[92px] shrink-0">
          <ChartContainer config={sleepConfig} className="aspect-square h-full w-full">
            <PieChart>
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel />}
              />
              <Pie
                data={stages}
                dataKey="minutes"
                nameKey="stage"
                innerRadius={32}
                outerRadius={46}
                strokeWidth={2}
                stroke="var(--card)"
              />
            </PieChart>
          </ChartContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-sm font-bold tabular-nums">{sleep.duration}</span>
            <span className="text-muted-foreground text-[10px]">total</span>
          </div>
        </div>

        <div className="grid min-w-0 flex-1 grid-cols-2 gap-1.5">
          <DetailChip label={`Deep · ${Math.round((sleep.deepMin / sleep.totalMin) * 100)}%`} value={sleep.deep} />
          <DetailChip label={`REM · ${Math.round((sleep.remMin / sleep.totalMin) * 100)}%`} value={sleep.rem} />
          <DetailChip label={`Light · ${Math.round((lightMin / sleep.totalMin) * 100)}%`} value={`${lightMin}m`} />
          <DetailChip label={`Awake · ${Math.round((sleep.awakeMin / sleep.totalMin) * 100)}%`} value={sleep.awake} />
        </div>
      </CardContent>
      <CardContent className="flex items-center justify-between gap-2 pt-0">
        <p className="text-muted-foreground truncate text-[11px]">{sleep.window}</p>
        <p className="text-muted-foreground shrink-0 text-[11px]">{sleep.trend ?? ''}</p>
      </CardContent>
    </Card>
  )
}

function Vo2MaxCard({ data }) {
  const vo = data.vo2max
  if (!vo) return <NoDataCard icon={Gauge} title="VO₂ Max" />
  const percent = Math.min(Math.round((vo.value / vo.goal) * 100), 100)

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitleWithIcon icon={Gauge} className="text-[var(--neon)]">
          VO₂ Max
        </CardTitleWithIcon>
        <CardAction>
          <Badge
            variant="outline"
            className={
              vo.rating === 'Excellent'
                ? 'border-transparent bg-[var(--neon)]/10 text-[var(--neon)]'
                : 'border-transparent bg-[var(--neon)]/10 text-[var(--neon)]'
            }
          >
            {vo.rating}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex items-center gap-3">
        <div className="relative size-[72px] shrink-0">
          <ChartContainer config={vo2Config} className="aspect-square h-full w-full">
            <RadialBarChart
              data={[{ key: 'vo2', value: percent, fill: 'var(--color-vo2)' }]}
              startAngle={90}
              endAngle={-270}
              innerRadius={25}
              outerRadius={36}
            >
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    hideLabel
                    formatter={(value) => (
                      <div className="flex w-full items-center justify-between gap-4">
                        <span className="text-muted-foreground">Goal progress</span>
                        <span className="font-mono font-medium tabular-nums">
                          {vo.value} / {vo.goal} ({value}%)
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <RadialBar dataKey="value" background cornerRadius={12} />
            </RadialBarChart>
          </ChartContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-sm leading-none font-bold tabular-nums">{vo.value}</span>
          </div>
        </div>

        <div className="grid min-w-0 flex-1 grid-cols-2 gap-1.5">
          <DetailChip label="Resting HR" value={vo.restingHr ? `${vo.restingHr} bpm` : '—'} />
          <DetailChip label="Fitness age" value={vo.fitnessAge ?? '—'} />
          <DetailChip
            label="Percentile"
            value={vo.rating === 'Excellent' ? 'Top 10%' : 'Top 25%'}
          />
          <DetailChip
            label="vs previous"
            value={vo.trend ? vo.trend.split(' ').slice(0, 2).join(' ') : '—'}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function BodyBatteryCard({ data }) {
  const battery = data.bodyBattery
  if (!battery) return <NoDataCard icon={BatteryCharging} title="Body Battery" />

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitleWithIcon icon={BatteryCharging} className="text-[var(--neon)]">
          Body Battery
        </CardTitleWithIcon>
        <CardAction>
          <Badge
            variant="outline"
            className={batteryStatusStyles[battery.status] ?? batteryStatusStyles.Balanced}
          >
            {battery.status}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex items-center gap-3">
        <div className="relative size-[92px] shrink-0">
          <ChartContainer config={batteryConfig} className="aspect-square h-full w-full">
            <RadialBarChart
              data={[{ key: 'battery', value: battery.level ?? 0, fill: 'var(--color-battery)' }]}
              startAngle={90}
              endAngle={-270}
              innerRadius={32}
              outerRadius={46}
            >
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    hideLabel
                    formatter={(value) => (
                      <div className="flex w-full items-center justify-between gap-4">
                        <span className="text-muted-foreground">Body battery</span>
                        <span className="font-mono font-medium tabular-nums">{value}/100</span>
                      </div>
                    )}
                  />
                }
              />
              <RadialBar dataKey="value" background cornerRadius={12} />
            </RadialBarChart>
          </ChartContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg leading-none font-bold tabular-nums">{battery.level ?? '—'}</span>
            <span className="text-muted-foreground mt-1 text-[9px]">of 100</span>
          </div>
        </div>

        <div className="grid min-w-0 flex-1 grid-cols-2 gap-1.5">
          <DetailChip label="Charged" value={battery.charged ?? '—'} />
          <DetailChip label="Drained" value={battery.drained ?? '—'} />
          <DetailChip label="Lowest" value={battery.low ?? '—'} />
          <DetailChip label="Highest" value={battery.high ?? '—'} />
        </div>
      </CardContent>
      <CardContent className="pt-0">
        <ChartContainer config={batteryConfig} className="h-[110px] w-full">
          <LineChart
            accessibilityLayer
            data={battery.series}
            margin={{ left: 12, right: 12, top: 4 }}
          >
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={4}
              minTickGap={16}
              tick={{ fontSize: 9 }}
            />
            <YAxis domain={[0, 100]} hide />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  hideLabel
                  formatter={(value, name) => {
                    if (value == null) return null
                    const labels = { battery: 'Battery', stress: 'Stress', rest: 'Rest mode' }
                    return (
                      <div className="flex w-full items-center justify-between gap-4">
                        <span className="text-muted-foreground">{labels[name] ?? name}</span>
                        <span className="font-mono font-medium tabular-nums">{value}/100</span>
                      </div>
                    )
                  }}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Line
              dataKey="battery"
              type="monotone"
              stroke="var(--color-battery)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3 }}
            />
            <Line
              dataKey="stress"
              type="monotone"
              stroke="var(--color-stress)"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
              activeDot={{ r: 3 }}
            />
            <Line
              dataKey="rest"
              type="stepAfter"
              stroke="var(--color-rest)"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              activeDot={{ r: 3 }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
      <CardContent className="pt-0">
        <p className="text-muted-foreground truncate text-[11px]">{battery.trend ?? ''}</p>
      </CardContent>
    </Card>
  )
}

export default function Dashboard() {
  const [period, setPeriod] = useState('today')
  const { data } = useApi(
    () => api.summary(period),
    [period],
    ['activity', 'daily', 'sleep', 'nutrition', 'weight', 'bodyBattery', 'heartRate', 'metrics', 'sync'],
    `summary:${period}`,
  )

  if (!data) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4 md:p-6">
        <Skeleton className="h-7 w-full max-w-sm" />
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }
  const s = data.stats

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-4 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title text-xl md:text-2xl">Dashboard</h1>
        <Tabs value={period} onValueChange={setPeriod}>
          <TabsList>
            {PERIODS.map((p) => (
              <TabsTrigger key={p.value} value={p.value}>
                {p.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </header>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          icon={Flame}
          label="Calories Taken"
          value={s.caloriesTaken.value}
          unit="kcal"
          note={s.caloriesTaken.note}
          trend={s.caloriesTaken.trend ? { value: s.caloriesTaken.trend, up: s.caloriesTaken.up } : null}
          good={s.caloriesTaken.good}
        />
        <StatCard
          icon={Activity}
          label="Calories Burned"
          value={s.caloriesBurned.value}
          unit="kcal"
          note={s.caloriesBurned.note}
          trend={s.caloriesBurned.trend ? { value: s.caloriesBurned.trend, up: s.caloriesBurned.up } : null}
          good={s.caloriesBurned.good}
        />
        <StatCard
          icon={Scale}
          label="Current Weight"
          value={s.weight.value}
          unit={s.weight.unit}
          note={s.weight.note}
          trend={s.weight.trend ? { value: `${s.weight.trend} kg`, up: !s.weight.up } : null}
          good={s.weight.good}
        />
        <StatCard
          icon={Footprints}
          label="Distance Ran"
          value={s.distanceKm.value}
          unit={s.distanceKm.unit}
          note={s.distanceKm.note}
          trend={s.distanceKm.trend ? { value: `${s.distanceKm.trend} km`, up: true } : null}
          good={s.distanceKm.good}
        />
      </section>

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="flex min-h-0 flex-col gap-3">
          <HeartRateCard data={data} />
          <SleepCard data={data} />
        </div>
        <div className="flex min-h-0 flex-col gap-3">
          <CalorieIntakeCard data={data} />
          <Vo2MaxCard data={data} />
          <BodyBatteryCard data={data} />
        </div>
      </section>
    </div>
  )
}
