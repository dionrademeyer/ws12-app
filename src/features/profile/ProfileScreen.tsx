import { useLearnerProfile } from '../../data/useLearnerProfile'
import { useI18n } from '../../i18n/useI18n'
import { Card } from '../../ui/Card'
import { LoadError, LoadingCard } from '../../ui/LoadStates'
import { PageTitle } from '../../ui/PageTitle'

export function ProfileScreen() {
  const { t, language } = useI18n()
  const state = useLearnerProfile()

  if (state.status === 'loading') return <LoadingCard />
  if (state.status === 'error') {
    return <LoadError message={t('dashboard.profileError')} onRetry={state.retry} />
  }

  const { profile } = state
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ')
  return (
    <div className="flex flex-col gap-4">
      <PageTitle>{t('menu.profile')}</PageTitle>
      <Card>
        <p className="text-xl font-bold">{fullName}</p>
        <p className="text-navy/80">{t('profile.grade', { grade: profile.grade })}</p>
        <h2 className="mt-4 font-bold">{t('profile.subjects')}</h2>
        <ul className="mt-2 list-disc pl-5">
          {profile.subjects.map((subject) => (
            <li key={subject.code}>{subject.name[language]}</li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
