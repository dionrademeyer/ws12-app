import type { MessageKey } from '../../i18n/messages'
import { useI18n } from '../../i18n/useI18n'
import { Card } from '../../ui/Card'
import { PageTitle } from '../../ui/PageTitle'

// Shell screen for sections that later sprints build, so navigation works end to end.
export function PlannedScreen({ titleKey }: { titleKey: MessageKey }) {
  const { t } = useI18n()
  return (
    <div className="flex flex-col gap-4">
      <PageTitle>{t(titleKey)}</PageTitle>
      <Card>
        <p>{t('planned.body')}</p>
      </Card>
    </div>
  )
}
