import type { MessageKey } from '../i18n/messages'
import type { IconName } from '../ui/Icon'

export interface NavItem {
  to: string
  labelKey: MessageKey
  icon: IconName
}

// The five tabs from the brief, shown in the bottom navigation and the sidebar.
export const primaryNav: NavItem[] = [
  { to: '/app/dashboard', labelKey: 'nav.dashboard', icon: 'dashboard' },
  { to: '/app/goals', labelKey: 'nav.goals', icon: 'goals' },
  { to: '/app/planner', labelKey: 'nav.planner', icon: 'planner' },
  { to: '/app/progress', labelKey: 'nav.progress', icon: 'progress' },
  { to: '/app/tutor', labelKey: 'nav.tutor', icon: 'tutor' },
]

// Extra sidebar links on desktop (Product Bible 2.5).
export const secondaryNav: NavItem[] = [
  { to: '/app/journey', labelKey: 'nav.journey', icon: 'journey' },
  { to: '/app/strategies', labelKey: 'nav.strategies', icon: 'strategies' },
  { to: '/app/library', labelKey: 'nav.library', icon: 'library' },
]

export interface MenuItem {
  to: string
  labelKey: MessageKey
}

// Secondary links open from the profile avatar; there is no hamburger menu.
export const avatarMenu: MenuItem[] = [
  { to: '/app/profile', labelKey: 'menu.profile' },
  { to: '/app/library', labelKey: 'menu.library' },
  { to: '/app/family', labelKey: 'menu.family' },
  { to: '/app/settings', labelKey: 'menu.settings' },
  { to: '/app/help', labelKey: 'menu.help' },
]

export const dashboardPath = '/app/dashboard'
