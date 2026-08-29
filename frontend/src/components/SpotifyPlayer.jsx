import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, MonitorSpeaker, Music2, Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SpotifyLogo } from '@/components/BrandLogos'
import { api } from '@/lib/api'
import { onLive } from '@/lib/live'
import { useSpotifyWebPlayer } from '@/hooks/useSpotifyWebPlayer'

const POLL_MS = 5000

const fmt = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/**
 * Spotify now-playing card. `variant="sidebar"` sits above the sidebar footer;
 * `variant="floating"` is a fixed mini-player shown when the sidebar is
 * collapsed. Polls every 5 s and interpolates progress locally in between.
 */
export default function SpotifyPlayer({ variant = 'sidebar' }) {
  const [connected, setConnected] = useState(null) // null = unknown yet
  const [player, setPlayer] = useState(null)
  const [progress, setProgress] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const web = useSpotifyWebPlayer()
  const lastSync = useRef({ at: 0, ms: 0, playing: false })

  const refresh = useCallback(async () => {
    try {
      const p = await api.nowPlaying()
      setPlayer(p)
      setConnected(true)
      setError('')
      lastSync.current = { at: Date.now(), ms: p.progressMs ?? 0, playing: p.isPlaying }
      setProgress(p.progressMs ?? 0)
    } catch (err) {
      if (err.status === 400) setConnected(false) // not connected — hide player
      else setError(err.message)
    }
  }, [])

  useEffect(() => {
    refresh()
    const poll = setInterval(refresh, POLL_MS)
    const offLive = onLive((type, data) => {
      if (type === 'connection' && data?.provider === 'spotify') refresh()
    })
    return () => {
      clearInterval(poll)
      offLive()
    }
  }, [refresh])

  // smooth local progress between polls
  useEffect(() => {
    const t = setInterval(() => {
      const { at, ms, playing } = lastSync.current
      if (playing) setProgress(Math.min(ms + (Date.now() - at), player?.track?.durationMs ?? Infinity))
    }, 1000)
    return () => clearInterval(t)
  }, [player])

  async function control(action) {
    setBusy(true)
    setError('')
    try {
      await api.spotifyControl(action)
      setTimeout(refresh, 400) // give Spotify a beat to apply it
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!connected) return null

  const track = player?.track
  const duration = track?.durationMs || 0
  const pct = duration ? Math.min(100, (progress / duration) * 100) : 0

  const body = (
    <div className="space-y-2">
      <div className="flex items-center gap-2.5">
        {track?.artUrlLarge || track?.artUrl ? (
          <img
            src={track.artUrlLarge ?? track.artUrl}
            alt=""
            className="size-10 shrink-0 rounded-md object-cover"
          />
        ) : (
          <div className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-md">
            <Music2 className="size-4" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          {track ? (
            <>
              <p className="truncate text-xs font-semibold">{track.name}</p>
              <p className="text-muted-foreground truncate text-[11px]">{track.artists}</p>
            </>
          ) : (
            <p className="text-muted-foreground text-[11px]">Nothing playing</p>
          )}
        </div>
        <SpotifyLogo className="size-4 shrink-0" />
      </div>

      {track && (
        <div className="space-y-1">
          <div className="bg-muted h-1 w-full overflow-hidden rounded-full">
            <div className="h-full rounded-full bg-[#1DB954] transition-[width]" style={{ width: `${pct}%` }} />
          </div>
          <div className="text-muted-foreground flex justify-between text-[9px] tabular-nums">
            <span>{fmt(progress)}</span>
            <span>{fmt(duration)}</span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="size-7 p-0" disabled={busy} onClick={() => control('previous')}>
            <SkipBack className="size-3.5" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="size-7 rounded-full p-0"
            disabled={busy}
            onClick={() => control(player?.isPlaying ? 'pause' : 'play')}
          >
            {player?.isPlaying ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          </Button>
          <Button size="sm" variant="ghost" className="size-7 p-0" disabled={busy} onClick={() => control('next')}>
            <SkipForward className="size-3.5" />
          </Button>
        </div>
        <Button
          size="sm"
          variant={web.status === 'ready' ? 'default' : 'ghost'}
          className="h-7 gap-1 px-2 text-[10px]"
          disabled={web.status === 'loading'}
          onClick={web.status === 'ready' ? web.disable : web.enable}
          title="Play full songs in this browser tab (Spotify Premium)"
        >
          {web.status === 'loading' ? <Loader2 className="size-3 animate-spin" /> : <MonitorSpeaker className="size-3" />}
          {web.status === 'ready' ? 'Playing here' : 'Play here'}
        </Button>
      </div>

      {player?.device && web.status !== 'ready' && (
        <p className="text-muted-foreground truncate text-[9px]">on {player.device.name}</p>
      )}
      {(error || web.error) && (
        <p className="text-destructive text-[9px]" role="alert">{error || web.error}</p>
      )}
    </div>
  )

  if (variant === 'floating') {
    return (
      <div className="bg-card fixed bottom-4 left-16 z-50 w-64 rounded-xl border p-3 shadow-xl max-md:bottom-[calc(4.5rem+env(safe-area-inset-bottom))] max-md:left-3">
        {body}
      </div>
    )
  }
  return <div className="bg-muted/40 mx-2 mb-1 rounded-xl border p-3">{body}</div>
}
