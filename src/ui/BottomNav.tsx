import { NavLink } from 'react-router-dom'
import type { NavItem } from '../app/navigation'
import { useI18n } from '../i18n/useI18n'
import { Icon } from './Icon'

export function BottomNav({ items }: { items: NavItem[] }) {
  const { t } = useI18n()
  return (
    <nav
      aria-label={t('a11y.mainNav')}
      className="fixed inset-x-0 bottom-0 z-20 border-t border-navy/10 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="mx-auto grid max-w-3xl grid-cols-5">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                `flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-center text-[11px] leading-tight font-medium ${
                  isActive ? 'text-indigo' : 'text-navy/70'
                }`
              }
            >
              <Icon name={item.icon} />
              <span>{t(item.labelKey)}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
