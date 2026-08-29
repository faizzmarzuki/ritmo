import { useEffect } from 'react'
import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { SettingsProvider } from '@/context/SettingsContext'
import AppSidebar from '@/components/AppSidebar'
import SpotifyPlayer from '@/components/SpotifyPlayer'
import FloatingChat from '@/components/FloatingChat'
import AccountDialog from '@/components/AccountDialog'
import { startLive, stopLive } from '@/lib/live'

function FloatingSpotify() {
  const { state, isMobile, openMobile } = useSidebar()
  const expanded = isMobile ? openMobile : state === 'expanded'
  if (expanded) return null
  return <SpotifyPlayer variant="floating" />
}

export default function AppShell({ user, onLogout }) {
  const [accountOpen, setAccountOpen] = useState(false)

  useEffect(() => {
    startLive()
    return () => stopLive()
  }, [])

  return (
    <SettingsProvider user={user}>
      <TooltipProvider>
        <SidebarProvider>
          <AppSidebar user={user} onOpenAccount={() => setAccountOpen(true)} />
          <FloatingSpotify />
          <FloatingChat />
          <AccountDialog open={accountOpen} onClose={() => setAccountOpen(false)} onLogout={onLogout} />
          <SidebarInset>
            {/* Desktop toggles via the sidebar rail; mobile needs a button to open the offcanvas menu. */}
            <div className="p-3 pb-0 md:hidden">
              <SidebarTrigger />
            </div>
            <Outlet />
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </SettingsProvider>
  )
}
