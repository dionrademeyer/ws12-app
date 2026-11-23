import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useSession } from '../../auth/useSession'
import { errorCodeOf, type ErrorCode } from '../../data/errors'
import type { LearnerExamDates, LearnerProfile, SubjectOption } from '../../data/learner'
import { useRepositoryQuery } from '../../data/useRepositoryQuery'
import { errorMessageKey } from '../../i18n/errorMessages'
import { useI18n } from '../../i18n/useI18n'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { ChoiceChips } from '../../ui/ChoiceChips'
import { LoadError, LoadingCard } from '../../ui/LoadStates'
import { Notice } from '../../ui/Notice'
import { PageTitle } from '../../ui/PageTitle'
import { TextField } from '../../ui/TextField'
import { ExamDateFields } from '../learner-fields/ExamDateFields'
import { ProvinceSelect } from '../learner-fields/ProvinceSelect'
import { SchoolPicker, type SchoolValue } from '../learner-fields/SchoolPicker'
import { SubjectPicker, type ChosenSubject } from '../learner-fields/SubjectPicker'

export type EditFocus = 'about' | 'subjects' | 'exams'

interface ProfileEditorProps {
  profile: LearnerProfile
  focus: EditFocus
  onCancel: () => void
  onSaved: (profile: LearnerProfile) => void
}

export function ProfileEditor(props: ProfileEditorProps) {
  const { t } = useI18n()
  const subjects = useRepositoryQuery((repository) => repository.listSubjects())

  return (
    <div className="flex flex-col gap-4">
      <PageTitle>{t('profile.editTitle')}</PageTitle>
      {subjects.state.status === 'loading' && <LoadingCard />}
      {subjects.state.status === 'error' && (
        <LoadError message={t('profile.subjectsError')} onRetry={subjects.retry} />
      )}
      {subjects.state.status === 'ready' && <EditForm {...props} subjects={subjects.state.data} />}
    </div>
  )
}

function EditForm({
  profile,
  focus,
  onCancel,
  onSaved,
  subjects,
}: ProfileEditorProps & { subjects: SubjectOption[] }) {
  const { t } = useI18n()
  const { repository } = useSession()
  const [firstName, setFirstName] = useState(profile.firstName)
  const [grade, setGrade] = useState(profile.grade === 11 ? 11 : 12)
  const [province, setProvince] = useState(profile.province ?? '')
  const [school, setSchool] = useState<SchoolValue>({
    school: profile.school,
    other: profile.schoolNameOther,
  })
  const [chosen, setChosen] = useState<ChosenSubject[]>(
    profile.subjects.map((subject) => ({ code: subject.code, targetMark: subject.targetMark })),
  )
  const [examDates, setExamDates] = useState<LearnerExamDates>(profile.examDates)
  const [problems, setProblems] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ErrorCode | null>(null)
  const sections = useRef<Record<EditFocus, HTMLElement | null>>({
    about: null,
    subjects: null,
    exams: null,
  })

  useEffect(() => {
    const section = sections.current[focus]
    section?.scrollIntoView?.({ block: 'start' })
    section?.querySelector<HTMLElement>('input, select, button')?.focus()
  }, [focus])

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!repository) return
    const found = new Set<string>()
    if (!firstName.trim()) found.add('firstName')
    if (chosen.length === 0) found.add('subjects')
    if (examDates.trial && examDates.final && examDates.trial >= examDates.final) found.add('exams')
    setProblems(found)
    if (found.size > 0) return

    setBusy(true)
    setError(null)
    try {
      const other = school.other?.trim() || null
      const next = await repository.updateProfile({
        firstName: firstName.trim(),
        grade,
        province: province || null,
        schoolId: other ? null : (school.school?.id ?? null),
        schoolNameOther: other,
        subjects: chosen.flatMap((entry) =>
          subjects.some((option) => option.code === entry.code)
            ? [{ code: entry.code, targetMark: entry.targetMark }]
            : [],
        ),
        examDates,
      })
      onSaved(next)
    } catch (cause) {
      setError(errorCodeOf(cause))
      setBusy(false)
    }
  }

  return (
    <form noValidate onSubmit={save} className="flex flex-col gap-4">
      <Card>
        <section
          ref={(node) => {
            sections.current.about = node
          }}
          className="flex flex-col gap-5"
          aria-labelledby="edit-about"
        >
          <h2 id="edit-about" className="text-lg font-bold">
            {t('onboarding.step1')}
          </h2>
          <TextField
            label={t('about.firstName')}
            autoComplete="given-name"
            maxLength={60}
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            error={problems.has('firstName') ? t('about.firstNameRequired') : null}
          />
          <ChoiceChips
            legend={t('about.grade')}
            single
            options={[
              { value: '12', label: t('profile.grade', { grade: 12 }) },
              { value: '11', label: t('about.grade11') },
            ]}
            selected={[String(grade)]}
            onChange={([value]) => setGrade(value === '11' ? 11 : 12)}
          />
          <ProvinceSelect value={province} onChange={setProvince} />
          <SchoolPicker province={province || null} value={school} onChange={setSchool} />
        </section>
      </Card>
      <Card>
        <section
          ref={(node) => {
            sections.current.subjects = node
          }}
          aria-labelledby="edit-subjects"
          className="flex flex-col gap-4"
        >
          <h2 id="edit-subjects" className="text-lg font-bold">
            {t('onboarding.step2')}
          </h2>
          <SubjectPicker
            subjects={subjects}
            chosen={chosen}
            onChange={setChosen}
            error={problems.has('subjects') ? t('subjects.required') : null}
          />
        </section>
      </Card>
      <Card>
        <section
          ref={(node) => {
            sections.current.exams = node
          }}
          aria-labelledby="edit-exams"
          className="flex flex-col gap-4"
        >
          <h2 id="edit-exams" className="text-lg font-bold">
            {t('onboarding.step3')}
          </h2>
          <ExamDateFields
            value={examDates}
            onChange={setExamDates}
            error={problems.has('exams') ? t('exams.order') : null}
          />
        </section>
      </Card>

      {error && (
        <Notice tone="error">
          {t('profile.saveFailed')} {t(errorMessageKey(error))}
        </Notice>
      )}
      <div className="flex flex-col gap-3 sm:flex-row-reverse">
        <Button type="submit" full busy={busy}>
          {error ? t('common.retry') : t('profile.save')}
        </Button>
        <Button variant="secondary" full onClick={onCancel} disabled={busy}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  )
}
