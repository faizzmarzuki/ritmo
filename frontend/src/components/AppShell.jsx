import { useEffect, useLayoutEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import {
  SidebarInset,
  SidebarProvider,
  useSidebar,
} from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { SettingsProvider } from '@/context/SettingsContext'
import AppSidebar from '@/components/AppSidebar'
import { BottomNav, MobileHeader } from '@/components/MobileNav'
import SpotifyPlayer from '@/components/SpotifyPlayer'
import { startLive, stopLive } from '@/lib/live'
import { api } from '@/lib/api'
import { prefetchApi } from '@/hooks/useApi'

function FloatingSpotify() {
  const { state, isMobile } = useSidebar()
  if (isMobile) return <SpotifyPlayer variant="pill" />
  if (state === 'expanded') return null
  return <SpotifyPlayer variant="floating" />
}

// Left-to-right order of the app's screens, mirroring the tab bar; navigating
// to a later screen slides in from the right, an earlier one from the left.
const SCREEN_ORDER = ['/workouts', '/nutrition', '/coach', '/you', '/settings']
const screenIndex = (path) => {
  const i = SCREEN_ORDER.findIndex((p) => path.startsWith(p))
  return i === -1 ? 0 : i + 1 // '/' (home) is 0
}

export default function AppShell({ user }) {
  const { pathname } = useLocation()
  const nav = useRef({ path: pathname, anim: 'page-fwd' })
  if (nav.current.path !== pathname) {
    nav.current = {
      path: pathname,
      anim: screenIndex(pathname) >= screenIndex(nav.current.path) ? 'page-fwd' : 'page-back',
    }
  }

  // Browsers keep the document scroll offset across client-side navigations, so a
  // new screen can paint mid-scroll and then snap once the shorter page clamps it
  // -- especially visible on iOS Safari, where the clamp also drags the toolbar
  // and its safe-area inset with it. Reset before paint, and stop the browser
  // restoring its own offset on back/forward so the two don't fight.
  useLayoutEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual'
    window.scrollTo(0, 0)
  }, [pathname])

  useEffect(() => {
    startLive()
    return () => stopLive()
  }, [])

  // Warm the tab-bar screens once the current one is painted and idle, so the
  // first visit to Workouts or Nutrition renders straight from cache. Without
  // this, their first open is a cold fetch: skeleton, then a full swap to real
  // content, which reads as the whole screen reloading.
  useEffect(() => {
    const warm = () => {
      prefetchApi('workouts', () => api.workouts())
      prefetchApi('nutrition', () => api.nutrition())
      prefetchApi('summary:today', () => api.summary('today'))
    }
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(warm, { timeout: 2000 })
      return () => cancelIdleCallback(id)
    }
    const t = setTimeout(warm, 600)
    return () => clearTimeout(t)
  }, [])

  return (
    <SettingsProvider user={user}>
      <TooltipProvider>
        <SidebarProvider>
          <AppSidebar user={user} />
          <FloatingSpotify />
          <SidebarInset>
            <MobileHeader />
            {/* Leave room for the fixed bottom tab bar on mobile, plus the
                Spotify dock when it's showing (--spotify-dock-h, see SpotifyPlayer). */}
            <div
              key={pathname}
              className={`${nav.current.anim} pb-[calc(4.5rem+var(--spotify-dock-h,0px)+env(safe-area-inset-bottom))] md:pb-0`}
            >
              <Outlet />
            </div>
            <BottomNav />
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </SettingsProvider>
  )
}
