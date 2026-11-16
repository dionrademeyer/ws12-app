import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/useI18n'

export function DemoBanner() {
  const { t } = useI18n()
  return (
    <aside
      aria-label={t('a11y.demoRegion')}
      className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-x-4 bg-gold px-4 py-1 text-xs text-navy sm:text-sm"
    >
      <p className="font-medium">{t('demo.banner')}</p>
      <Link
        to="/register"
        className="inline-flex min-h-11 items-center font-bold underline underline-offset-2"
      >
        {t('demo.createAccount')}
      </Link>
    </aside>
  )
}
