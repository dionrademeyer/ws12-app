import { Link } from 'react-router-dom'
import { dashboardPath } from '../../app/navigation'
import { useI18n } from '../../i18n/useI18n'

export function RegisterScreen() {
  const { t } = useI18n()
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-mist px-5 text-center">
      <h1 className="text-2xl font-bold">{t('register.title')}</h1>
      <p className="max-w-sm">{t('register.soon')}</p>
      <Link
        to={dashboardPath}
        className="inline-flex min-h-12 items-center rounded-full bg-indigo px-6 font-bold text-white"
      >
        {t('register.backToDemo')}
      </Link>
    </main>
  )
}
