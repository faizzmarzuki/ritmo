import { BotMessageSquare, Dumbbell, House, Nut, Settings, UserRound } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useSettings } from '@/context/SettingsContext'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar'
import RitmoLogo, { RitmoIcon } from '@/components/RitmoLogo'
import SpotifyPlayer from '@/components/SpotifyPlayer'
import ThemeToggle from '@/components/ThemeToggle'

const items = [
  { title: 'Home', icon: House, path: '/' },
  { title: 'Workouts', icon: Dumbbell, path: '/workouts' },
  { title: 'Nutrition', icon: Nut, path: '/nutrition' },
  { title: 'Coach', icon: BotMessageSquare, path: '/coach' },
  { title: 'You', icon: UserRound, path: '/you' },
]

export default function AppSidebar({ user, ...props }) {
  const { pathname } = useLocation()
  const { settings } = useSettings()
  const { state, isMobile, openMobile } = useSidebar()
  const expanded = isMobile ? openMobile : state === 'expanded'

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <Link to="/" className="flex items-center px-2 py-1.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <RitmoIcon className="hidden size-8 shrink-0 group-data-[collapsible=icon]:block" />
          <RitmoLogo className="h-7 w-auto text-foreground group-data-[collapsible=icon]:hidden" />
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={item.path === '/' ? pathname === '/' : pathname.startsWith(item.path)}
                    tooltip={item.title}
                  >
                    <Link to={item.path}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {expanded && <SpotifyPlayer variant="sidebar" />}

      <SidebarFooter>
        <div className="flex items-center gap-1 px-1 py-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <Link
            to="/you"
            title="Your profile & progress"
            className="hover:bg-muted/70 flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 text-left transition-colors group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
          >
            {settings.avatar ? (
              <img
                src={settings.avatar}
                alt="Profile"
                className="aspect-square size-8 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="bg-muted text-muted-foreground flex aspect-square size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold uppercase">
                {(settings.name ?? '?').charAt(0)}
              </div>
            )}
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-medium">{settings.name ?? 'Guest'}</p>
              <p className="text-muted-foreground truncate text-xs capitalize">
                via {user?.provider ?? 'email'}
              </p>
            </div>
          </Link>
          <Link
            to="/settings"
            title="Settings"
            className="text-muted-foreground hover:text-foreground hover:bg-muted/70 flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors group-data-[collapsible=icon]:hidden"
          >
            <Settings className="size-4" />
          </Link>
          <ThemeToggle className="shrink-0 group-data-[collapsible=icon]:hidden" />
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
