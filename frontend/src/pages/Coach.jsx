import { useEffect, useRef, useState } from 'react'
import {
  BedDouble, BotMessageSquare, Check, ChevronDown, Flame, HeartPulse, History,
  Loader2, MessageSquare, Send, SquarePen, Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import EmptyState from '@/components/EmptyState'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { api } from '@/lib/api'
import { useApi } from '@/hooks/useApi'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning.'
  if (h < 18) return 'Good afternoon.'
  return 'Good evening.'
}

const fmtDay = (sqliteUtc) =>
  new Date(`${sqliteUtc.replace(' ', 'T')}Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

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
function ChatStarter({ onAsk }) {
  const { data } = useApi(() => api.summary('today'), [], ['daily', 'sleep', 'nutrition', 'heartRate', 'sync'], 'summary:today')
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
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <div className="flex flex-col gap-0.5 pt-2">
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

function ConversationList({ conversations, activeId, onSelect, onDelete }) {
  if (!conversations.length) {
    return (
      <EmptyState
        size="sm"
        icon={MessageSquare}
        title="No conversations yet"
        description="Ask your coach about training, food or recovery to start one."
      />
    )
  }
  return (
    <div className="flex flex-col gap-1 p-2">
      {conversations.map((c) => (
        <div
          key={c.id}
          className={`group flex items-center gap-1 rounded-lg transition-colors ${
            c.id === activeId ? 'bg-accent' : 'hover:bg-muted/70'
          }`}
        >
          <button
            type="button"
            className="flex min-w-0 flex-1 flex-col gap-0.5 px-2.5 py-2 text-left"
            onClick={() => onSelect(c.id)}
          >
            <span className="truncate text-xs font-medium">{c.title}</span>
            <span className="text-muted-foreground truncate text-[10px]">
              {fmtDay(c.updated_at)} · {c.last_message || `${c.message_count} messages`}
            </span>
          </button>
          <Button
            size="icon"
            variant="ghost"
            className="text-muted-foreground hover:text-destructive size-6 shrink-0 opacity-0 group-hover:opacity-100 max-md:opacity-100"
            aria-label="Delete conversation"
            onClick={() => onDelete(c.id)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ))}
    </div>
  )
}

/**
 * The health coach as a full page. Conversations persist server-side; the
 * backend recalls strongly related snippets from earlier conversations, so
 * things mentioned before (injuries, plans, preferences) carry over.
 */
export default function Coach() {
  const [conversations, setConversations] = useState(null) // null = loading
  const [activeId, setActiveId] = useState(null)
  const [messages, setMessages] = useState([])
  const [loadingThread, setLoadingThread] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [steps, setSteps] = useState([])
  const scrollRef = useRef(null)
  // Bumped on every thread switch / new chat; async completions from a
  // previous thread compare against it and drop their result instead of
  // overwriting the newly selected thread's state.
  const genRef = useRef(0)
  // One id per logical turn, kept across retries of the same content so the
  // server can replay a reply that was persisted but never reached us.
  const pendingTurnRef = useRef(null)

  const refreshConversations = () =>
    // On failure keep whatever is already loaded; only the initial load (still
    // null) falls back to an empty list, so a failed post-send refresh doesn't
    // make existing conversations vanish.
    api.chatConversations().then(setConversations).catch(() => setConversations((list) => list ?? []))

  useEffect(() => {
    refreshConversations()
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy, steps])

  async function openConversation(id) {
    setHistoryOpen(false)
    if (id === activeId) return
    const gen = ++genRef.current
    pendingTurnRef.current = null // retry ids belong to the thread they started in
    setActiveId(id)
    setError('')
    setBusy(false) // abandon any in-flight send; its completion is gen-guarded
    setSteps([])
    setLoadingThread(true)
    try {
      const { messages: msgs } = await api.chatConversation(id)
      if (gen !== genRef.current) return // user moved on; keep their new thread
      setMessages(msgs.map((m) => ({
        role: m.role,
        content: m.content,
        steps: m.meta?.steps,
        ms: m.meta?.ms,
      })))
    } catch (err) {
      if (gen !== genRef.current) return
      setError(err.message)
      setMessages([])
    } finally {
      if (gen === genRef.current) setLoadingThread(false)
    }
  }

  function newChat() {
    genRef.current += 1
    pendingTurnRef.current = null
    setHistoryOpen(false)
    setActiveId(null)
    setMessages([])
    setError('')
    setBusy(false)
    setSteps([])
    setLoadingThread(false)
  }

  async function removeConversation(id) {
    if (!window.confirm('Delete this conversation?')) return
    try {
      await api.deleteChatConversation(id)
      setConversations((list) => (list || []).filter((c) => c.id !== id))
      if (id === activeId) newChat()
    } catch (err) {
      setError(err.message)
    }
  }

  async function send(text) {
    const content = (text ?? input).trim()
    if (!content || busy) return
    setInput('')
    setError('')
    setMessages((m) => [...m, { role: 'user', content }])
    setBusy(true)
    setSteps([])
    const gen = genRef.current
    const pending = pendingTurnRef.current
    const turnId = pending?.content === content && pending.conversationId === activeId
      ? pending.turnId
      : (crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`)
    pendingTurnRef.current = { turnId, content, conversationId: activeId }
    const trail = []
    try {
      const reply = await api.chat(content, activeId, (label) => {
        trail.push(label)
        if (gen === genRef.current) setSteps([...trail])
      }, turnId)
      if (pendingTurnRef.current?.turnId === turnId) pendingTurnRef.current = null
      // The reply is saved server-side either way, so the list refresh is
      // always worthwhile; everything below only applies while the user is
      // still on the thread this send belongs to.
      refreshConversations()
      if (gen !== genRef.current) return
      setMessages((m) => [...m, { role: 'assistant', content: reply.text, steps: trail, ms: reply.ms }])
      if (reply.conversationId && reply.conversationId !== activeId) setActiveId(reply.conversationId)
    } catch (err) {
      if (gen !== genRef.current) return
      setError(err.message)
      setMessages((m) => m.slice(0, -1)) // roll back the optimistic user message on failure
      setInput(content)
    } finally {
      if (gen === genRef.current) {
        setBusy(false)
        setSteps([])
      }
    }
  }

  const thread = (
    <>
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-4 pb-4">
        {loadingThread && (
          <div className="space-y-2 pt-2">
            <Skeleton className="ml-auto h-9 w-1/2" />
            <Skeleton className="h-20 w-3/4" />
          </div>
        )}
        {!loadingThread && messages.length === 0 && <ChatStarter onAsk={send} />}
        {messages.map((m, i) => (
          <div
            key={`${i}-${m.role}`}
            className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap md:text-sm ${
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
            aria-label="Send message"
            style={{ margin: 0 }}
            className="size-9 shrink-0 rounded-lg shadow-[0_0_18px_color-mix(in_srgb,var(--neon)_35%,transparent)] disabled:shadow-none"
            disabled={busy || !input.trim()}
          >
            <Send className="size-4" />
          </Button>
        </div>
      </form>
    </>
  )

  return (
    <div className="mx-auto flex h-[calc(100dvh-7rem-var(--spotify-dock-h,0px)-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-full max-w-5xl gap-4 md:h-svh md:p-6">
      {/* Conversation history — permanent column on desktop, sheet on mobile. */}
      <aside className="bg-card hidden w-64 shrink-0 flex-col overflow-hidden rounded-xl border md:flex">
        <div className="flex items-center justify-between border-b px-3 py-2.5">
          <span className="flex items-center gap-1.5 text-xs font-semibold">
            <History className="size-3.5" />
            History
          </span>
          <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-[11px]" onClick={newChat}>
            <SquarePen className="size-3" />
            New chat
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations === null
            ? <div className="space-y-2 p-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}</div>
            : (
              <ConversationList
                conversations={conversations}
                activeId={activeId}
                onSelect={openConversation}
                onDelete={removeConversation}
              />
            )}
        </div>
      </aside>

      <div className="bg-card flex min-w-0 flex-1 flex-col overflow-hidden md:rounded-xl md:border">
        <div className="flex items-center justify-between border-b px-3.5 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <BotMessageSquare className="size-4 shrink-0 text-[var(--neon)]" />
            <span className="truncate text-[13px] font-semibold">
              {conversations?.find((c) => c.id === activeId)?.title || 'Health coach'}
            </span>
          </div>
          <div className="flex items-center gap-1 md:hidden">
            <Button size="icon" variant="ghost" className="size-8" aria-label="Conversation history" onClick={() => setHistoryOpen(true)}>
              <History className="size-4" />
            </Button>
            <Button size="icon" variant="ghost" className="size-8" aria-label="New chat" onClick={newChat}>
              <SquarePen className="size-4" />
            </Button>
          </div>
        </div>
        {thread}
      </div>

      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent side="bottom" className="max-h-[70dvh] rounded-t-2xl pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
          <SheetHeader className="pb-0">
            <SheetTitle className="flex items-center gap-2 text-sm">
              <MessageSquare className="size-4 text-[var(--neon)]" />
              Conversations
            </SheetTitle>
            <SheetDescription className="text-xs">
              The coach remembers these — mention something once and it can bring it up later.
            </SheetDescription>
          </SheetHeader>
          <div className="overflow-y-auto">
            {conversations !== null && (
              <ConversationList
                conversations={conversations}
                activeId={activeId}
                onSelect={openConversation}
                onDelete={removeConversation}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
