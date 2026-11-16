import { useI18n } from '../../i18n/useI18n'
import { Card } from '../../ui/Card'
import { LanguageSwitch } from '../../ui/LanguageSwitch'
import { PageTitle } from '../../ui/PageTitle'

export function SettingsScreen() {
  const { t } = useI18n()
  return (
    <div className="flex flex-col gap-4">
      <PageTitle>{t('menu.settings')}</PageTitle>
      <Card>
        <h2 className="font-bold">{t('language.label')}</h2>
        <p className="mt-1 mb-3 text-navy/80">{t('settings.languageHint')}</p>
        <LanguageSwitch />
      </Card>
    </div>
  )
}
