import { NavLink } from 'react-router-dom'
import type { NavItem } from '../app/navigation'
import { useI18n } from '../i18n/useI18n'
import { Icon } from './Icon'

function SidebarLink({ item }: { item: NavItem }) {
  const { t } = useI18n()
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        `flex min-h-11 items-center gap-3 rounded-xl px-3 font-medium ${
          isActive ? 'bg-indigo text-white' : 'text-navy hover:bg-indigo/10'
        }`
      }
    >
      <Icon name={item.icon} className="h-5 w-5" />
      <span>{t(item.labelKey)}</span>
    </NavLink>
  )
}

export function Sidebar({ primary, secondary }: { primary: NavItem[]; secondary: NavItem[] }) {
  const { t } = useI18n()
  return (
    <nav
      aria-label={t('a11y.mainNav')}
      className="hidden w-64 shrink-0 flex-col gap-1 border-r border-navy/10 bg-white p-4 lg:flex"
    >
      <ul className="flex flex-col gap-1">
        {primary.map((item) => (
          <li key={item.to}>
            <SidebarLink item={item} />
          </li>
        ))}
      </ul>
      <hr className="my-3 border-navy/10" />
      <ul className="flex flex-col gap-1">
        {secondary.map((item) => (
          <li key={item.to}>
            <SidebarLink item={item} />
          </li>
        ))}
      </ul>
    </nav>
  )
}
