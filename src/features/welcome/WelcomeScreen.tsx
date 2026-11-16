import { useNavigate } from 'react-router-dom'
import { dashboardPath } from '../../app/navigation'
import { useSession } from '../../auth/useSession'
import { useI18n } from '../../i18n/useI18n'
import { LanguageSwitch } from '../../ui/LanguageSwitch'

export function WelcomeScreen() {
  const { t } = useI18n()
  const { enterDemo } = useSession()
  const navigate = useNavigate()

  return (
    <main className="flex min-h-dvh flex-col bg-gradient-to-b from-navy to-indigo px-5 py-8 text-white">
      <div className="flex justify-end">
        <LanguageSwitch tone="dark" />
      </div>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 text-center">
        <p className="text-5xl font-extrabold tracking-wide text-gold">{t('app.shortName')}</p>
        <h1 className="text-2xl font-bold">{t('app.name')}</h1>
        <p className="text-lg">{t('welcome.tagline')}</p>
        <button
          type="button"
          onClick={() => {
            enterDemo()
            navigate(dashboardPath)
          }}
          className="min-h-12 rounded-full bg-gold px-6 text-lg font-bold text-navy shadow-md"
        >
          {t('welcome.tryDemo')}
        </button>
        <p className="text-sm text-white/85">{t('welcome.signInSoon')}</p>
        <p className="text-sm text-white/85">{t('welcome.basedOn')}</p>
      </div>
    </main>
  )
}
