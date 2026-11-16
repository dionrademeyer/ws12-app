import { Link } from 'react-router-dom'
import { dashboardPath } from '../../app/navigation'
import { useI18n } from '../../i18n/useI18n'
import { Card } from '../../ui/Card'

export function NotFoundScreen() {
  const { t } = useI18n()
  return (
    <Card className="text-center">
      <h1 className="text-xl font-bold">{t('notFound.title')}</h1>
      <Link
        to={dashboardPath}
        className="mt-4 inline-flex min-h-11 items-center rounded-full bg-indigo px-5 font-semibold text-white"
      >
        {t('notFound.action')}
      </Link>
    </Card>
  )
}
