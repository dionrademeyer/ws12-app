import { useState } from 'react'
import { Link } from 'react-router-dom'
import { familyPath } from '../../auth/accountRouting'
import type { LearnerProfile } from '../../data/learner'
import { useRepositoryQuery } from '../../data/useRepositoryQuery'
import { isProvince } from '../../domain/onboarding'
import { useI18n } from '../../i18n/useI18n'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { LoadError, LoadingCard } from '../../ui/LoadStates'
import { Notice } from '../../ui/Notice'
import { PageTitle } from '../../ui/PageTitle'
import { formatDate } from '../../ui/formatDate'
import { ProfileEditor, type EditFocus } from './ProfileEditor'

export function ProfileScreen() {
  const { t } = useI18n()
  const query = useRepositoryQuery((repository) => repository.getProfile())
  const [editing, setEditing] = useState<EditFocus | null>(null)
  const [saved, setSaved] = useState(false)

  if (query.state.status === 'loading') return <LoadingCard />
  if (query.state.status === 'error') {
    return <LoadError message={t('dashboard.profileError')} onRetry={query.retry} />
  }

  const profile = query.state.data

  if (editing) {
    return (
      <ProfileEditor
        profile={profile}
        focus={editing}
        onCancel={() => setEditing(null)}
        onSaved={(next) => {
          query.setData(next)
          setEditing(null)
          setSaved(true)
        }}
      />
    )
  }

  return (
    <ProfileView
      profile={profile}
      saved={saved}
      onEdit={(focus) => {
        setSaved(false)
        setEditing(focus)
      }}
    />
  )
}

function AddPrompt({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 items-center gap-1 font-bold text-indigo underline underline-offset-2"
    >
      <span aria-hidden="true">+</span>
      {label}
    </button>
  )
}

function ProfileView({
  profile,
  saved,
  onEdit,
}: {
  profile: LearnerProfile
  saved: boolean
  onEdit: (focus: EditFocus) => void
}) {
  const { t, language } = useI18n()
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ')
  const schoolName = profile.school?.name ?? profile.schoolNameOther
  const missingExam = !profile.examDates.trial && !profile.examDates.final

  return (
    <div className="flex flex-col gap-4">
      <PageTitle>{t('menu.profile')}</PageTitle>
      {saved && <Notice tone="success">{t('common.saved')}</Notice>}

      <section className="on-dark rounded-3xl bg-gradient-to-br from-navy to-indigo p-6 text-white shadow-md">
        <p className="text-2xl font-bold">{fullName || t('profile.noName')}</p>
        <p className="mt-1 text-white/90">{t('profile.grade', { grade: profile.grade })}</p>
        <p className="mt-1 text-white/90">
          {schoolName ?? (
            <button
              type="button"
              onClick={() => onEdit('about')}
              className="min-h-11 font-bold text-gold underline underline-offset-2"
            >
              <span aria-hidden="true">+ </span>
              {t('profile.addSchool')}
            </button>
          )}
        </p>
        {isProvince(profile.province) && (
          <p className="mt-1 text-white/90">{t(`province.${profile.province}`)}</p>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="text-lg font-bold">{t('profile.subjects')}</h2>
          {profile.subjects.length === 0 ? (
            <div className="mt-2">
              <p className="text-navy/80">{t('profile.noSubjects')}</p>
              <AddPrompt label={t('profile.addSubjects')} onClick={() => onEdit('subjects')} />
            </div>
          ) : (
            <ul className="mt-3 flex flex-col divide-y divide-navy/10">
              {profile.subjects.map((subject) => (
                <li
                  key={subject.code}
                  className="flex min-h-11 items-center justify-between gap-2 py-2"
                >
                  <span className="font-medium">{subject.name[language]}</span>
                  {subject.targetMark !== null ? (
                    <span className="shrink-0 rounded-full bg-indigo/10 px-3 py-1 text-sm font-bold whitespace-nowrap text-indigo">
                      {t('profile.target', { mark: subject.targetMark })}
                    </span>
                  ) : (
                    <AddPrompt label={t('subjects.addTarget')} onClick={() => onEdit('subjects')} />
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="text-lg font-bold">{t('profile.examDates')}</h2>
          {missingExam ? (
            <p className="mt-2 text-navy/80">{t('profile.noExamDates')}</p>
          ) : (
            <dl className="mt-3 flex flex-col gap-2">
              {(['trial', 'final'] as const).map((kind) => (
                <div key={kind} className="flex min-h-11 items-center justify-between gap-2">
                  <dt className="font-medium">{t(`exams.${kind}`)}</dt>
                  <dd>
                    {profile.examDates[kind] ? (
                      formatDate(profile.examDates[kind], language)
                    ) : (
                      <AddPrompt label={t('profile.addDate')} onClick={() => onEdit('exams')} />
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          <p className="mt-3 text-sm text-navy/75">{t('exams.provisional')}</p>
        </Card>
      </div>

      {missingExam ? (
        <Button full onClick={() => onEdit('exams')}>
          {t('profile.addExamDate')}
        </Button>
      ) : (
        <Button full onClick={() => onEdit('about')}>
          {t('profile.edit')}
        </Button>
      )}

      <nav aria-label={t('profile.moreLinks')} className="flex flex-wrap justify-center gap-x-6">
        <Link
          to={familyPath}
          className="inline-flex min-h-11 items-center font-bold text-indigo underline"
        >
          {t('menu.family')}
        </Link>
        <Link
          to="/app/settings"
          className="inline-flex min-h-11 items-center font-bold text-indigo underline"
        >
          {t('menu.settings')}
        </Link>
      </nav>
    </div>
  )
}
