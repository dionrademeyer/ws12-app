import { languages } from '../domain/language'
import { useI18n } from '../i18n/useI18n'

export function LanguageSwitch({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const { language, setLanguage, t } = useI18n()
  const idle = tone === 'dark' ? 'text-white hover:bg-white/10' : 'text-navy hover:bg-indigo/10'

  return (
    <div role="group" aria-label={t('language.label')} className="inline-flex gap-1">
      {languages.map((option) => (
        <button
          key={option}
          type="button"
          lang={option}
          aria-pressed={language === option}
          onClick={() => setLanguage(option)}
          className={`min-h-11 rounded-full px-4 font-semibold ${
            language === option ? 'bg-gold text-navy' : idle
          }`}
        >
          {t(`language.${option}`)}
        </button>
      ))}
    </div>
  )
}
