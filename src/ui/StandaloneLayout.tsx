import type { ReactNode } from 'react'
import { useSession } from '../auth/useSession'
import { useI18n } from '../i18n/useI18n'
import { DemoBanner } from './DemoBanner'
import { LanguageSwitch } from './LanguageSwitch'

// Layout for screens outside the app shell: sign-in, consent and onboarding.
export function StandaloneLayout({
  children,
  wide = false,
}: {
  children: ReactNode
  wide?: boolean
}) {
  const { t } = useI18n()
  const { mode } = useSession()
  return (
    <div className="flex min-h-dvh flex-col bg-mist">
      {mode === 'demo' && <DemoBanner />}
      <header className="on-dark bg-gradient-to-r from-navy to-indigo text-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-2">
          <p className="flex flex-col leading-none">
            <span className="text-xl font-extrabold tracking-wide text-gold">
              {t('app.shortName')}
            </span>
            <span className="text-[10px] font-semibold tracking-[0.12em]">{t('app.wordmark')}</span>
          </p>
          <LanguageSwitch tone="dark" />
        </div>
      </header>
      <main
        id="main"
        className={`mx-auto flex w-full flex-1 flex-col gap-5 px-4 py-6 ${wide ? 'max-w-2xl' : 'max-w-md'}`}
      >
        {children}
      </main>
    </div>
  )
}
