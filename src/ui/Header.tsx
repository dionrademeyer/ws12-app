import type { ReactNode } from 'react'
import { useI18n } from '../i18n/useI18n'
import { Icon } from './Icon'

interface HeaderProps {
  onBack?: () => void
  notificationsLink: ReactNode
  avatar: ReactNode
}

export function Header({ onBack, notificationsLink, avatar }: HeaderProps) {
  const { t } = useI18n()
  return (
    <header className="on-dark bg-navy text-white">
      <div className="mx-auto grid h-16 max-w-6xl grid-cols-[3rem_1fr_auto] items-center gap-2 px-3">
        <div>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label={t('common.back')}
              className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10"
            >
              <Icon name="back" />
            </button>
          )}
        </div>
        <p className="flex flex-col items-center leading-none sm:flex-row sm:gap-3">
          <span className="text-xl font-extrabold tracking-wide text-gold">
            {t('app.shortName')}
          </span>
          <span className="text-[10px] font-semibold tracking-[0.12em] sm:text-xs">
            {t('app.wordmark')}
          </span>
        </p>
        <div className="flex items-center gap-1">
          {notificationsLink}
          {avatar}
        </div>
      </div>
    </header>
  )
}
