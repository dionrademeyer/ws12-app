import { useI18n } from '../../i18n/useI18n'
import { Card } from '../../ui/Card'
import { PageTitle } from '../../ui/PageTitle'

export function NotificationsScreen() {
  const { t } = useI18n()
  return (
    <div className="flex flex-col gap-4">
      <PageTitle>{t('notifications.title')}</PageTitle>
      <Card>
        <p>{t('notifications.empty')}</p>
      </Card>
    </div>
  )
}
