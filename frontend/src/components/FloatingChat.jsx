import { useEffect, useRef, useState } from 'react'
import { BedDouble, Check, ChevronDown, Flame, HeartPulse, Loader2, MessageCircleHeart, Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { useApi } from '@/hooks/useApi'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning.'
  if (h < 18) return 'Good afternoon.'
  return 'Good evening.'
}

function StatTile({ icon: Icon, value, label }) {
  return (
    <div className="bg-muted/50 flex flex-col gap-1 rounded-lg border p-2.5">
      <Icon className="size-3.5 text-[var(--neon)]" />
      <span className="text-sm font-semibold tabular-nums">{value ?? '—'}</span>
      <span className="text-muted-foreground text-[10px]">{label}</span>
    </div>
  )
}

/**
 * Empty state: greeting, a snapshot of today, and suggestions grounded in the
 * user's own numbers so the coach visibly "knows" them before the first message.
 */
function EmptyState({ onAsk }) {
  const { data } = useApi(() => api.summary('today'), [], ['daily', 'sleep', 'nutrition', 'heartRate', 'sync'])
  const sleep = data?.sleep
  const kcal = data?.stats?.caloriesTaken
  const kcalLeft = kcal?.goal != null && kcal?.value != null ? Math.max(kcal.goal - kcal.value, 0) : null

  const suggestions = [
    {
      q: 'How can I improve my sleep?',
      context: sleep?.quality ? `Quality ${sleep.quality} last night` : 'Duration, stages and consistency',
      highlight: true,
    },
    {
      q: 'What should I eat for my next meal?',
      context: kcalLeft != null ? `${kcalLeft.toLocaleString()} kcal left in today's budget` : "Based on what you've eaten today",
    },
    {
      q: 'How is my day going so far?',
      context: 'Steps, stress and body battery at a glance',
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-lg font-semibold tracking-tight">{greeting()}</h2>
        <p className="text-muted-foreground text-xs">Here's where you stand today.</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StatTile icon={BedDouble} value={sleep?.duration} label="Sleep" />
        <StatTile
          icon={HeartPulse}
          value={data?.hrSummary?.resting ? `${data.hrSummary.resting} bpm` : null}
          label="Resting HR"
        />
        <StatTile
          icon={Flame}
          value={kcal?.value != null ? kcal.value.toLocaleString() : null}
          label={kcal?.goal ? `of ${kcal.goal.toLocaleString()} kcal` : 'kcal eaten'}
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
          Worth asking about
        </span>
        {suggestions.map((sug) => (
          <button
            key={sug.q}
            type="button"
            className={`flex w-full flex-col gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-colors ${
              sug.highlight
                ? 'bg-accent hover:bg-accent/80 border-[var(--neon)]/25'
                : 'bg-muted/50 hover:bg-muted'
            }`}
            onClick={() => onAsk(sug.q)}
          >
            <span className="text-xs font-medium">{sug.q}</span>
            <span className={`text-[11px] ${sug.highlight ? 'text-accent-foreground' : 'text-muted-foreground'}`}>
              {sug.context}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** Live research trail — spinner on the newest step, checks on the finished ones. */
function ThinkingSteps({ steps, live }) {
  return (
    <div className="text-muted-foreground space-y-1 text-[11px]">
      {steps.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          {live && i === steps.length - 1 ? (
            <Loader2 className="size-3 shrink-0 animate-spin" />
          ) : (
            <Check className="size-3 shrink-0 text-[var(--neon)]" />
          )}
          <span>{label}</span>
        </div>
      ))}
    </div>
  )
}

/** Collapsed "thought for Xs" header attached to a finished reply. */
function ThoughtHeader({ steps, ms }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mb-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-[10px] transition-colors"
      >
        <Check className="size-3 text-[var(--neon)]" />
        Researched your data{ms ? ` · ${(ms / 1000).toFixed(1)}s` : ''}
        <ChevronDown className={`size-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="mt-1.5"><ThinkingSteps steps={steps} live={false} /></div>}
    </div>
  )
}

/**
 * Floating AI coach (bottom-right). Grounded in the user's own data via
 * /api/chat — the backend injects a compact snapshot and keeps the model
 * on-topic and cheap (short history, small max_tokens).
 */
export default function FloatingChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [steps, setSteps] = useState([])
  const scrollRef = useRef(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy, steps, open])

  async function send(text) {
    const content = (text ?? input).trim()
    if (!content || busy) return
    setInput('')
    setError('')
    const next = [...messages, { role: 'user', content }]
    setMessages(next)
    setBusy(true)
    setSteps([])
    const trail = []
    try {
      const reply = await api.chat(next, (label) => {
        trail.push(label)
        setSteps([...trail])
      })
      setMessages((m) => [...m, { role: 'assistant', content: reply.text, steps: trail, ms: reply.ms }])
    } catch (err) {
      setError(err.message)
      setMessages(messages) // roll back the optimistic user message on failure
      setInput(content)
    } finally {
      setBusy(false)
      setSteps([])
    }
  }

  if (!open) {
    return (
      <Button
        size="icon"
        className="fixed right-4 bottom-4 z-50 size-12 rounded-full shadow-lg"
        onClick={() => setOpen(true)}
        title="Ask your health coach"
      >
        <MessageCircleHeart className="size-5" />
      </Button>
    )
  }

  return (
    <div className="bg-card fixed right-4 bottom-4 z-50 flex h-[34rem] w-[22.5rem] flex-col overflow-hidden rounded-xl border shadow-xl">
      <div className="flex items-center justify-between px-3.5 py-3">
        <div className="flex items-center gap-2">
          <MessageCircleHeart className="size-4 text-[var(--neon)]" />
          <span className="text-[13px] font-semibold">Health coach</span>
        </div>
        <Button size="icon" variant="ghost" className="size-6" onClick={() => setOpen(false)}>
          <X className="size-3.5" />
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-4 pb-4">
        {messages.length === 0 && <EmptyState onAsk={send} />}
        {messages.map((m, i) => (
          <div
            key={`${i}-${m.role}`}
            className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
              m.role === 'user'
                ? 'bg-primary text-primary-foreground ml-auto'
                : 'bg-muted/60'
            }`}
          >
            {m.role === 'assistant' && m.steps?.length > 0 && <ThoughtHeader steps={m.steps} ms={m.ms} />}
            {m.content}
          </div>
        ))}
        {busy && (
          <div className="bg-muted/60 max-w-[85%] rounded-lg px-3 py-2">
            {steps.length > 0
              ? <ThinkingSteps steps={steps} live />
              : <Loader2 className="text-muted-foreground size-3.5 animate-spin" />}
          </div>
        )}
        {error && <p className="text-destructive text-[10px]" role="alert">{error}</p>}
      </div>

      <form
        className="border-t p-3"
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        <div style={{ alignItems: 'center' }} className="border-input bg-background flex gap-2 rounded-xl border p-1.5 pl-3.5">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your data…"
            style={{ height: 36, padding: 0, margin: 0 }}
            className="placeholder:text-muted-foreground flex-1 bg-transparent text-sm outline-none"
          />
          <Button
            type="submit"
            size="icon"
            style={{ margin: 0 }}
            className="size-9 shrink-0 rounded-lg shadow-[0_0_18px_color-mix(in_srgb,var(--neon)_35%,transparent)] disabled:shadow-none"
            disabled={busy || !input.trim()}
          >
            <Send className="size-4" />
          </Button>
        </div>
      </form>
    </div>
  )
}
