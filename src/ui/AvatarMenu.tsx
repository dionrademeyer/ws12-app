import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import type { MenuItem } from '../app/navigation'
import { useI18n } from '../i18n/useI18n'

interface AvatarMenuProps {
  initials: string
  items: MenuItem[]
  onLogout: () => void
}

const itemClass =
  'flex min-h-11 w-full items-center px-4 text-left text-navy hover:bg-indigo/10 focus-visible:bg-indigo/10'

export function AvatarMenu({ initials, items, onLogout }: AvatarMenuProps) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    if (!open) return
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()

    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function onMenuKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const entries = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    )
    const current = entries.indexOf(document.activeElement as HTMLElement)
    const step = event.key === 'ArrowDown' ? 1 : -1
    entries[(current + step + entries.length) % entries.length]?.focus()
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={t('a11y.accountMenu')}
        onClick={() => setOpen((value) => !value)}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-gold text-sm font-bold text-navy"
      >
        {initials}
      </button>
      {open && (
        <ul
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={t('a11y.accountMenu')}
          onKeyDown={onMenuKeyDown}
          className="on-light absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-2xl bg-white py-2 shadow-lg ring-1 ring-navy/10"
        >
          {items.map((item) => (
            <li key={item.to} role="none">
              <Link
                role="menuitem"
                to={item.to}
                className={itemClass}
                onClick={() => setOpen(false)}
              >
                {t(item.labelKey)}
              </Link>
            </li>
          ))}
          <li role="none" className="mt-1 border-t border-navy/10 pt-1">
            <button
              type="button"
              role="menuitem"
              className={itemClass}
              onClick={() => {
                setOpen(false)
                onLogout()
              }}
            >
              {t('menu.logout')}
            </button>
          </li>
        </ul>
      )}
    </div>
  )
}
