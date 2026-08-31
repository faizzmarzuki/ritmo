import { useEffect, useRef, useState } from 'react'
import { Beef, Camera, ChevronDown, Droplet, Droplets, Flame, Loader2, Plus, Trash2, UtensilsCrossed, Wheat, X } from 'lucide-react'
import { PolarAngleAxis, RadialBar, RadialBarChart } from 'recharts'
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

const caloriesConfig = {
  eaten: { label: 'Eaten', color: 'var(--neon)' },
}

function CalorieRingCard({ day, burned }) {
  const calorieGoal = day.calorieGoal || 2200
  const eaten = day.totals.kcal
  const left = calorieGoal - eaten
  const percent = Math.min(Math.round((eaten / calorieGoal) * 100), 100)

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-sm">
          <Flame className="size-4 text-[var(--neon)]" />
          Calories
        </CardTitle>
        <CardAction>
          <Badge variant="outline" className="border-transparent bg-[var(--neon)]/10 text-[var(--neon)]">
            {percent}% of goal
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex items-center gap-4">
        <div className="relative size-[110px] shrink-0">
          <ChartContainer config={caloriesConfig} className="aspect-square h-full w-full">
            <RadialBarChart
              data={[{ key: 'eaten', value: percent, fill: 'var(--color-eaten)' }]}
              startAngle={90}
              endAngle={-270}
              innerRadius={34}
              outerRadius={50}
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
                          {eaten.toLocaleString()} / {calorieGoal.toLocaleString()} kcal
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
            <span className="text-lg leading-none font-bold tabular-nums">{left.toLocaleString()}</span>
            <span className="text-muted-foreground mt-0.5 text-[9px]">kcal left</span>
          </div>
        </div>

        <div className="grid min-w-0 flex-1 grid-cols-1 gap-1.5">
          <div className="bg-muted/60 flex items-center justify-between rounded-md px-3 py-2">
            <span className="text-muted-foreground text-xs font-medium">Taken</span>
            <span className="text-sm font-semibold tabular-nums">
              {eaten.toLocaleString()} <span className="text-muted-foreground text-[10px]">kcal</span>
            </span>
          </div>
          <div className="bg-muted/60 flex items-center justify-between rounded-md px-3 py-2">
            <span className="text-muted-foreground text-xs font-medium">Burned</span>
            <span className="text-sm font-semibold tabular-nums text-[var(--neon)]">
              -{burned} <span className="text-[10px]">kcal</span>
            </span>
          </div>
          <div className="bg-muted/60 flex items-center justify-between rounded-md px-3 py-2">
            <span className="text-muted-foreground text-xs font-medium">Net</span>
            <span className="text-sm font-semibold tabular-nums">
              {(eaten - burned).toLocaleString()} <span className="text-muted-foreground text-[10px]">kcal</span>
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function MacroBar({ icon: Icon, label, value, goal, unit }) {
  const percent = Math.min(Math.round((value / goal) * 100), 100)

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
          <Icon className="size-3.5" />
          {label}
        </span>
        <span className="font-mono tabular-nums">
          {value} / {goal} {unit}
        </span>
      </div>
      <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
        <div
          className="bg-primary h-full rounded-full transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

function MacrosCard({ macros }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-sm">Macros & hydration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <MacroBar icon={Beef} label="Protein" {...macros.protein} />
        <MacroBar icon={Wheat} label="Carbs" {...macros.carbs} />
        <MacroBar icon={Droplet} label="Fat" {...macros.fat} />
        <div className="flex items-center justify-between border-t pt-3 text-xs">
          <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
            <Droplets className="size-3.5 text-[var(--neon)]" /> Water
          </span>
          <span className="font-mono tabular-nums">
            {macros.water.value} / {macros.water.goal} {macros.water.unit}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

const SLOT_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', snack: 'Snack', dinner: 'Dinner' }

function FoodRow({ food, photo, mealId, open, onToggle, onDelete, onCorrected }) {
  const [fixName, setFixName] = useState('')
  const [fixBusy, setFixBusy] = useState(false)
  const [fixError, setFixError] = useState('')

  async function submitFix(e) {
    e.preventDefault()
    if (!fixName.trim() || fixBusy) return
    setFixBusy(true)
    setFixError('')
    try {
      await api.correctMeal(mealId, fixName.trim())
      onCorrected?.()
    } catch (err) {
      setFixError(err.message || 'Correction failed')
    } finally {
      setFixBusy(false)
    }
  }

  return (
    <div className="bg-muted/40 hover:bg-muted/70 overflow-hidden rounded-lg transition-colors">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-left"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          {photo ? (
            <img src={api.photoUrl(photo)} alt={food.name} className="size-10 shrink-0 rounded-md object-cover" />
          ) : (
            <div className="bg-background flex size-10 shrink-0 items-center justify-center rounded-md">
              <UtensilsCrossed className="text-muted-foreground size-4" />
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{food.name}</p>
            <p className="text-muted-foreground text-[11px]">{food.portion}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-sm font-semibold tabular-nums">{food.kcal} kcal</span>
          <ChevronDown
            className={`text-muted-foreground size-4 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {open && (
        <div className="border-t px-3 pt-2.5 pb-3">
          {photo && (
            <img src={api.photoUrl(photo)} alt={food.name} className="mb-2 h-36 w-full rounded-lg object-cover" />
          )}
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            <div className="bg-background rounded-md px-2.5 py-1.5 text-center">
              <p className="text-sm font-semibold tabular-nums">{food.protein} g</p>
              <p className="text-muted-foreground text-[10px]">Protein</p>
            </div>
            <div className="bg-background rounded-md px-2.5 py-1.5 text-center">
              <p className="text-sm font-semibold tabular-nums">{food.carbs} g</p>
              <p className="text-muted-foreground text-[10px]">Carbs</p>
            </div>
            <div className="bg-background rounded-md px-2.5 py-1.5 text-center">
              <p className="text-sm font-semibold tabular-nums">{food.fat} g</p>
              <p className="text-muted-foreground text-[10px]">Fat</p>
            </div>
            <div className="bg-background rounded-md px-2.5 py-1.5 text-center">
              <p className="text-sm font-semibold tabular-nums">{food.fiber} g</p>
              <p className="text-muted-foreground text-[10px]">Fiber</p>
            </div>
            <div className="bg-background rounded-md px-2.5 py-1.5 text-center">
              <p className="text-sm font-semibold tabular-nums">{food.sugar} g</p>
              <p className="text-muted-foreground text-[10px]">Sugar</p>
            </div>
            <div className="bg-background rounded-md px-2.5 py-1.5 text-center">
              <p className="text-sm font-semibold tabular-nums">{food.grams ? `${Math.round(food.grams)} g` : '—'}</p>
              <p className="text-muted-foreground text-[10px]">Portion</p>
            </div>
          </div>
          {mealId && photo && (
            <form onSubmit={submitFix} style={{ flexDirection: 'row', alignItems: 'center' }} className="mt-2 flex gap-1.5">
              <input
                value={fixName}
                onChange={(e) => setFixName(e.target.value)}
                placeholder="AI got it wrong? type the real name"
                className="bg-background h-9 flex-1 rounded-lg border-none px-2.5 text-xs outline-none"
                maxLength={120}
              />
              <Button type="submit" size="sm" variant="outline" style={{ margin: 0 }} className="h-9 shrink-0 text-xs" disabled={fixBusy || !fixName.trim()}>
                {fixBusy ? 'Re-analyzing…' : 'Fix & learn'}
              </Button>
            </form>
          )}
          {fixError && <p className="text-destructive mt-1 text-xs">{fixError}</p>}
          <Button
            variant="outline"
            size="sm"
            className="text-destructive mt-2"
            onClick={() => onDelete(food.id)}
          >
            <Trash2 data-icon="inline-start" />
            Remove
          </Button>
        </div>
      )}
    </div>
  )
}

/** One card per meal slot — all foods logged for that slot, however they were added. */
function SlotSection({ slot, meals, openFood, setOpenFood, onDeleteItem, onCorrected }) {
  const foods = meals.flatMap((m) => m.items.map((i) => ({ ...i, _meal: m })))
  if (foods.length === 0) return null
  const total = Math.round(foods.reduce((s, f) => s + f.kcal, 0))

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-sm">
          <UtensilsCrossed className="text-muted-foreground size-4" />
          {SLOT_LABELS[slot] ?? slot}
        </CardTitle>
        <CardAction>
          <Badge variant="outline">{foods.length} foods · {total} kcal</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {foods.map((food) => (
          <FoodRow
            key={food.id}
            food={food}
            photo={food._meal.photo_path}
            mealId={food._meal.photo_path ? food._meal.id : null}
            open={openFood === food.id}
            onToggle={() => setOpenFood(openFood === food.id ? null : food.id)}
            onDelete={onDeleteItem}
            onCorrected={onCorrected}
          />
        ))}
      </CardContent>
    </Card>
  )
}

/** Claude-style add-food modal: photo and/or name in, AI-estimated macros out. */
function AddFoodDialog({ open, onClose, onDone }) {
  const [slot, setSlot] = useState('snack')
  const [name, setName] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => e.key === 'Escape' && !busy && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onClose])

  function pickFile(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setFile(f)
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old)
      return URL.createObjectURL(f)
    })
  }

  async function submit(e) {
    e.preventDefault()
    if (busy || (!file && !name.trim())) return
    setBusy(true)
    setError('')
    try {
      if (file) await api.analyzeAndLogFood(file, slot, name.trim())
      else await api.logFoodByName(name.trim(), slot)
      setName('')
      setFile(null)
      if (preview) URL.revokeObjectURL(preview)
      setPreview(null)
      onDone()
    } catch (err) {
      setError(err.message || 'Could not log this food')
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Add food">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={() => !busy && onClose()} />
      <div className="bg-card absolute top-1/2 left-1/2 w-[min(94vw,26rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Add food</h2>
          <Button size="icon" variant="ghost" className="size-7" onClick={onClose} disabled={busy} title="Close">
            <X className="size-4" />
          </Button>
        </div>
        <form onSubmit={submit} className="space-y-2.5">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickFile} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="border-muted-foreground/25 hover:border-muted-foreground/50 flex h-36 w-full cursor-pointer flex-col items-center justify-center gap-1.5 overflow-hidden rounded-lg border border-dashed transition-colors"
          >
            {preview ? (
              <img src={preview} alt="Selected food" className="h-full w-full object-cover" />
            ) : (
              <>
                <Camera className="text-muted-foreground size-6" />
                <span className="text-muted-foreground text-xs">Add a photo (optional) — the AI reads the portion size</span>
              </>
            )}
          </button>
          <div className="flex gap-2">
            <select
              value={slot}
              onChange={(e) => setSlot(e.target.value)}
              className="border-input bg-background h-9 rounded-md border px-2 text-sm"
            >
              {Object.entries(SLOT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <Input
              placeholder="Name, e.g. char kuey teow kerang"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              className="h-9 flex-1"
            />
          </div>
          <p className="text-muted-foreground text-[11px]">
            The AI estimates calories and macros — give a photo, a name, or both. Named foods are remembered.
          </p>
          {error && <p className="text-destructive text-xs" role="alert">{error}</p>}
          <Button type="submit" size="sm" className="w-full" disabled={busy || (!file && !name.trim())}>
            {busy ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Plus data-icon="inline-start" />}
            {busy ? 'Analyzing…' : 'Analyze & log'}
          </Button>
        </form>
      </div>
    </div>
  )
}

export default function Nutrition() {
  const [openFood, setOpenFood] = useState(null)
  const [showAdd, setShowAdd] = useState(false)

  const { data: day, refetch } = useApi(() => api.nutrition(), [], ['nutrition', 'hydration'], 'nutrition')
  const { data: summary } = useApi(() => api.summary('today'), [], ['activity', 'daily', 'sync'], 'summary:today')

  async function onDeleteItem(id) {
    await api.deleteFoodItem(id)
    refetch()
  }

  if (!day) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-6">
        <Skeleton className="h-7 w-full max-w-sm" />
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title text-xl md:text-2xl">Nutrition</h1>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus data-icon="inline-start" />
          Add food
        </Button>
      </header>

      <AddFoodDialog open={showAdd} onClose={() => setShowAdd(false)} onDone={() => { setShowAdd(false); refetch() }} />

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <CalorieRingCard day={day} burned={summary?.stats.caloriesBurned.value ?? 0} />
        <MacrosCard macros={day.macros} />
      </section>

      <section className="space-y-3">
        {day.meals.length === 0 && (
          <EmptyState
            icon={UtensilsCrossed}
            title="Nothing logged today"
            description="Snap a photo of your meal or just type its name — the AI fills in the calories and macros."
          />
        )}
        {Object.keys(SLOT_LABELS).map((slot) => (
          <SlotSection
            key={slot}
            slot={slot}
            meals={day.meals.filter((m) => m.slot === slot)}
            openFood={openFood}
            setOpenFood={setOpenFood}
            onDeleteItem={onDeleteItem}
            onCorrected={refetch}
          />
        ))}
      </section>
    </div>
  )
}
