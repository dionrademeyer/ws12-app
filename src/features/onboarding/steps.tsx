import { useEffect, useRef } from 'react'
import { useSession } from '../../auth/useSession'
import type { SubjectOption } from '../../data/learner'
import {
  careerInterests,
  examDate,
  examYearFor,
  studyBands,
  studyDays,
  withExamDate,
  type OnboardingForm,
  type StepProblem,
} from '../../domain/onboarding'
import { useI18n } from '../../i18n/useI18n'
import { ChoiceChips } from '../../ui/ChoiceChips'
import { TextField } from '../../ui/TextField'
import { ExamDateFields } from '../learner-fields/ExamDateFields'
import { ProvinceSelect } from '../learner-fields/ProvinceSelect'
import { SchoolPicker } from '../learner-fields/SchoolPicker'
import { SubjectPicker } from '../learner-fields/SubjectPicker'

interface StepProps {
  answers: OnboardingForm
  onChange: (next: OnboardingForm) => void
  problems?: StepProblem[]
}

export function AboutStep({ answers, onChange, problems = [] }: StepProps) {
  const { t } = useI18n()
  return (
    <>
      <TextField
        label={t('about.firstName')}
        autoComplete="given-name"
        maxLength={60}
        value={answers.first_name}
        onChange={(event) => onChange({ ...answers, first_name: event.target.value })}
        error={problems.includes('first_name') ? t('about.firstNameRequired') : null}
      />
      <ChoiceChips
        legend={t('about.grade')}
        single
        options={[
          { value: '12', label: t('profile.grade', { grade: 12 }) },
          { value: '11', label: t('about.grade11') },
        ]}
        selected={[String(answers.grade)]}
        onChange={([grade]) => onChange({ ...answers, grade: grade === '11' ? 11 : 12 })}
      />
      <ProvinceSelect
        value={answers.province}
        onChange={(province) => onChange({ ...answers, province })}
        error={problems.includes('province') ? t('province.required') : null}
      />
      <SchoolPicker
        province={answers.province || null}
        value={{
          school: answers.school_id
            ? { id: answers.school_id, name: answers.school_name ?? '', province: answers.province }
            : null,
          other: answers.school_name_other,
        }}
        onChange={({ school, other }) =>
          onChange({
            ...answers,
            school_id: school?.id ?? null,
            school_name: school?.name ?? null,
            school_name_other: other,
          })
        }
      />
    </>
  )
}

export function SubjectStep({
  answers,
  subjects,
  suggested,
  onChange,
  problems = [],
}: StepProps & { subjects: SubjectOption[]; suggested: string[] }) {
  const { t } = useI18n()
  return (
    <SubjectPicker
      subjects={subjects}
      suggested={suggested}
      chosen={answers.subjects.map((subject) => ({
        code: subject.code,
        targetMark: subject.target_mark,
      }))}
      onChange={(chosen) =>
        onChange({
          ...answers,
          subjects: chosen.map((entry) => ({ code: entry.code, target_mark: entry.targetMark })),
        })
      }
      error={problems.includes('subjects') ? t('subjects.required') : null}
    />
  )
}

export function ExamStep({ answers, onChange, problems = [] }: StepProps) {
  const { t } = useI18n()
  const { repository } = useSession()
  const latest = useRef({ answers, onChange })
  useEffect(() => {
    latest.current = { answers, onChange }
  })

  // Prefill once from the WS12 exam calendar when the learner has no dates yet.
  const needsPrefill = answers.exam_dates.length === 0
  const year = examYearFor(answers.grade, new Date())
  useEffect(() => {
    if (!repository || !needsPrefill) return
    let active = true
    repository
      .getExamCalendar(year)
      .then((calendar) => {
        if (!active) return
        let next = latest.current.answers
        if (next.exam_dates.length > 0) return
        if (calendar.trial) next = withExamDate(next, 'trial', calendar.trial)
        if (calendar.final) next = withExamDate(next, 'final', calendar.final)
        if (next !== latest.current.answers) latest.current.onChange(next)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [repository, needsPrefill, year])

  return (
    <>
      <p>{t('exams.intro', { year })}</p>
      <ExamDateFields
        value={{
          trial: examDate(answers, 'trial') || null,
          final: examDate(answers, 'final') || null,
        }}
        onChange={(dates) => {
          let next = withExamDate(answers, 'trial', dates.trial ?? '')
          next = withExamDate(next, 'final', dates.final ?? '')
          onChange(next)
        }}
        error={problems.includes('exam_order') ? t('exams.order') : null}
      />
    </>
  )
}

export function StudyStep({ answers, onChange }: StepProps) {
  const { t } = useI18n()
  return (
    <>
      <ChoiceChips
        legend={t('study.days')}
        hint={t('study.daysHint')}
        options={studyDays.map((day) => ({ value: day, label: t(`day.${day}`) }))}
        selected={answers.study_days}
        onChange={(study_days) =>
          onChange({ ...answers, study_days: studyDays.filter((d) => study_days.includes(d)) })
        }
      />
      <ChoiceChips
        legend={t('study.bands')}
        hint={t('study.bandsHint')}
        options={studyBands.map((band) => ({
          value: band,
          label: t(`band.${band}`),
          detail: t(`band.${band}.time`),
        }))}
        selected={answers.study_bands}
        onChange={(study_bands) =>
          onChange({ ...answers, study_bands: studyBands.filter((b) => study_bands.includes(b)) })
        }
      />
    </>
  )
}

export function GoalStep({
  answers,
  subjects,
  onChange,
}: StepProps & { subjects: SubjectOption[] }) {
  const { t, language } = useI18n()
  const suggestions = answers.subjects
    .filter((entry) => entry.target_mark !== null)
    .slice(0, 3)
    .flatMap((entry) => {
      const subject = subjects.find((option) => option.code === entry.code)
      return subject
        ? [t('goal.suggestion', { subject: subject.name[language], mark: entry.target_mark ?? 0 })]
        : []
    })
  const goalOptions = [...suggestions, t('goal.passAll')]

  return (
    <>
      <ChoiceChips
        legend={t('goal.suggestionsLegend')}
        hint={t('goal.suggestionsHint')}
        single
        options={goalOptions.map((goal) => ({ value: goal, label: goal }))}
        selected={answers.goal ? [answers.goal] : []}
        onChange={([goal]) => onChange({ ...answers, goal: goal ?? null })}
      />
      <TextField
        label={t('goal.own')}
        maxLength={200}
        value={answers.goal ?? ''}
        onChange={(event) => onChange({ ...answers, goal: event.target.value })}
      />
      <ChoiceChips
        legend={t('career.legend')}
        hint={t('career.hint')}
        options={careerInterests.map((career) => ({ value: career, label: t(`career.${career}`) }))}
        selected={answers.career_interests}
        onChange={(career_interests) => onChange({ ...answers, career_interests })}
      />
    </>
  )
}
