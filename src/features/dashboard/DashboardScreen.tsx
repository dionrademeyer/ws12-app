import { Link, useSearchParams } from 'react-router-dom'
import { useSession } from '../../auth/useSession'
import { useLearnerProfile } from '../../data/useLearnerProfile'
import { useI18n } from '../../i18n/useI18n'
import { buttonClass } from '../../ui/buttonClass'
import { Card } from '../../ui/Card'
import { LoadError, LoadingCard } from '../../ui/LoadStates'

export function DashboardScreen() {
  const { t, language } = useI18n()
  const { mode } = useSession()
  const [params] = useSearchParams()
  const state = useLearnerProfile()

  if (state.status === 'loading') return <LoadingCard />
  if (state.status === 'error') {
    return <LoadError message={t('dashboard.profileError')} onRetry={state.retry} />
  }

  const { profile } = state
  const firstTime = params.get('welcome') === '1'
  return (
    <div className="flex flex-col gap-4">
      <section className="on-dark rounded-3xl bg-gradient-to-br from-navy to-indigo p-6 text-white shadow-md">
        <h1 className="text-2xl font-bold">
          {firstTime
            ? t('dashboard.firstWelcome', { name: profile.firstName })
            : t('dashboard.greeting', { name: profile.firstName })}
        </h1>
        <p className="mt-2 text-white/90">
          {mode === 'demo' ? t('dashboard.intro') : t('dashboard.introAccount')}
        </p>
      </section>
      <Card>
        <h2 className="text-lg font-bold">{t('dashboard.subjectsTitle')}</h2>
        {profile.subjects.length === 0 ? (
          <div className="mt-2 flex flex-col items-start gap-3">
            <p>{t('profile.noSubjects')}</p>
            <Link to="/app/profile" className={buttonClass('primary')}>
              {t('profile.addSubjects')}
            </Link>
          </div>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {profile.subjects.map((subject) => (
              <li
                key={subject.code}
                className="rounded-full bg-indigo/10 px-3 py-1.5 text-sm font-medium"
              >
                {subject.name[language]}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
