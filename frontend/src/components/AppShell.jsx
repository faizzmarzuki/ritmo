import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
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
import FloatingChat from '@/components/FloatingChat'
import { startLive, stopLive } from '@/lib/live'

function FloatingSpotify() {
  const { state, isMobile } = useSidebar()
  const expanded = !isMobile && state === 'expanded'
  if (expanded) return null
  return <SpotifyPlayer variant="floating" />
}

export default function AppShell({ user }) {
  useEffect(() => {
    startLive()
    return () => stopLive()
  }, [])

  return (
    <SettingsProvider user={user}>
      <TooltipProvider>
        <SidebarProvider>
          <AppSidebar user={user} />
          <FloatingSpotify />
          <FloatingChat />
          <SidebarInset>
            <MobileHeader />
            {/* Leave room for the fixed bottom tab bar on mobile. */}
            <div className="pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
              <Outlet />
            </div>
            <BottomNav />
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </SettingsProvider>
  )
}
