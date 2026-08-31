import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, MonitorSpeaker, Music2, Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SpotifyLogo } from '@/components/BrandLogos'
import { api } from '@/lib/api'
import { onLive } from '@/lib/live'
import { useSpotifyWebPlayer } from '@/hooks/useSpotifyWebPlayer'
import { useViewportSettled } from '@/hooks/useViewportSettled'

const POLL_MS = 5000

const fmt = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/**
 * Average color of the album art, for tinting the mobile pill player the way
 * the Spotify app does. Spotify's image CDN sends CORS headers, so a tainted
 * canvas only happens on failure — then we fall back to the plain dark pill.
 */
function useAlbumColor(url) {
  const [rgb, setRgb] = useState(null)
  useEffect(() => {
    if (!url) {
      setRgb(null)
      return undefined
    }
    let alive = true
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const c = document.createElement('canvas')
        c.width = c.height = 16
        const g = c.getContext('2d')
        g.drawImage(img, 0, 0, 16, 16)
        const d = g.getImageData(0, 0, 16, 16).data
        let r = 0, gr = 0, b = 0
        for (let i = 0; i < d.length; i += 4) {
          r += d[i]
          gr += d[i + 1]
          b += d[i + 2]
        }
        const n = d.length / 4
        if (alive) setRgb([r / n, gr / n, b / n].map(Math.round))
      } catch {
        if (alive) setRgb(null)
      }
    }
    img.onerror = () => {
      if (alive) setRgb(null)
    }
    img.src = url
    return () => {
      alive = false
    }
  }, [url])
  return rgb
}

/** Dark blend of the album color — keeps white text readable on any art. */
const tint = (rgb, f) => `rgb(${rgb.map((v) => Math.round(v * f)).join(',')})`

/**
 * Spotify now-playing card. `variant="sidebar"` sits above the sidebar footer;
 * `variant="floating"` is a fixed mini-player shown when the sidebar is
 * collapsed; `variant="pill"` is the mobile floating bar tinted with the album
 * color. Polls every 5 s and interpolates progress locally in between.
 */
export default function SpotifyPlayer({ variant = 'sidebar' }) {
  const [connected, setConnected] = useState(null) // null = unknown yet
  const [player, setPlayer] = useState(null)
  const [progress, setProgress] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const web = useSpotifyWebPlayer()
  const lastSync = useRef({ at: 0, ms: 0, playing: false })
  const dockRef = useRef(null)
  const settled = useViewportSettled()

  // Publish the floating dock's height as a CSS var so the page can pad
  // exactly enough for content behind it to stay reachable (see AppShell).
  useEffect(() => {
    if ((variant !== 'floating' && variant !== 'pill') || !connected) return undefined
    const el = dockRef.current
    if (!el) return undefined
    const root = document.documentElement
    // The pill floats with a gap above the nav, so pad a little extra for it.
    const extra = variant === 'pill' ? 16 : 0
    const ro = new ResizeObserver(() => root.style.setProperty('--spotify-dock-h', `${el.offsetHeight + extra}px`))
    ro.observe(el)
    return () => {
      ro.disconnect()
      root.style.removeProperty('--spotify-dock-h')
    }
  }, [variant, connected])

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

  const artUrl = player?.track?.artUrlLarge ?? player?.track?.artUrl ?? null
  const albumRgb = useAlbumColor(variant === 'pill' ? artUrl : null)

  if (!connected) return null

  const track = player?.track
  const duration = track?.durationMs || 0
  const pct = duration ? Math.min(100, (progress / duration) * 100) : 0

  if (variant === 'pill') {
    // Spotify-app-style mobile mini player: floating pill above the tab bar,
    // tinted with the album color, white foreground, thin progress line.
    const pillBtn = (extra = '') =>
      `flex items-center justify-center rounded-full text-white transition-colors disabled:opacity-40 ${extra}`
    return (
      <div
        ref={dockRef}
        style={albumRgb
          ? { background: `linear-gradient(135deg, ${tint(albumRgb, 0.62)}, ${tint(albumRgb, 0.34)})` }
          : undefined}
        className={`fixed inset-x-2 z-40 rounded-xl bg-neutral-800 p-2 text-white shadow-lg shadow-black/30 transition-opacity duration-150 max-md:bottom-[calc(3.75rem+env(safe-area-inset-bottom))] md:hidden ${
          settled ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="flex items-center gap-2.5">
          {artUrl ? (
            <img src={artUrl} alt="" className="size-10 shrink-0 rounded-md object-cover" />
          ) : (
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-white/10">
              <Music2 className="size-4 text-white/70" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            {track ? (
              <>
                <p className="truncate text-xs font-semibold">{track.name}</p>
                <p className="truncate text-[11px] text-white/70">{track.artists}</p>
              </>
            ) : (
              <p className="text-[11px] text-white/70">Nothing playing</p>
            )}
          </div>
          <button
            type="button"
            title="Play full songs in this browser tab (Spotify Premium)"
            disabled={web.status === 'loading'}
            onClick={web.status === 'ready' ? web.disable : web.enable}
            className={pillBtn(`size-8 ${web.status === 'ready' ? 'bg-white/25' : 'active:bg-white/15'}`)}
          >
            {web.status === 'loading'
              ? <Loader2 className="size-4 animate-spin" />
              : <MonitorSpeaker className="size-4" />}
          </button>
          <button type="button" disabled={busy} onClick={() => control('previous')} className={pillBtn('size-8 active:bg-white/15')}>
            <SkipBack className="size-4" />
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => control(player?.isPlaying ? 'pause' : 'play')}
            className={pillBtn('size-9 active:bg-white/15')}
          >
            {player?.isPlaying ? <Pause className="size-5" /> : <Play className="size-5" />}
          </button>
          <button type="button" disabled={busy} onClick={() => control('next')} className={pillBtn('size-8 active:bg-white/15')}>
            <SkipForward className="size-4" />
          </button>
        </div>
        {track && (
          <div className="mt-1.5 h-0.5 overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-white transition-[width]" style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
    )
  }

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
    // Desktop with collapsed sidebar: floating card in the bottom-left.
    return (
      <div ref={dockRef} className="bg-card fixed bottom-4 left-16 z-40 w-64 rounded-xl border p-3 shadow-xl max-md:hidden">
        {body}
      </div>
    )
  }
  return <div className="bg-muted/40 mx-2 mb-1 rounded-xl border p-3">{body}</div>
}
