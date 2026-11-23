// Onboarding answers in the shape save_onboarding expects (docs/api-contract.md).

export const provinces = ['EC', 'FS', 'GP', 'KZN', 'LP', 'MP', 'NC', 'NW', 'WC'] as const
export type Province = (typeof provinces)[number]

export function isProvince(value: unknown): value is Province {
  return typeof value === 'string' && (provinces as readonly string[]).includes(value)
}

export const studyDays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
export type StudyDay = (typeof studyDays)[number]

// Bands from Product Bible 3.4.
export const studyBands = ['morning', 'afternoon', 'evening', 'late'] as const
export type StudyBand = (typeof studyBands)[number]

export const careerInterests = [
  'engineering',
  'health',
  'business',
  'law',
  'education',
  'technology',
  'science',
  'creative',
  'trades',
  'agriculture',
  'not_sure',
] as const
export type CareerInterest = (typeof careerInterests)[number]

export const suggestedSubjectCodes = { lifeOrientation: 'LO', en: 'ENHL', af: 'AFHL' } as const

export const onboardingStepCount = 5

export interface OnboardingSubject {
  code: string
  target_mark: number | null
}

export interface OnboardingAnswers {
  first_name: string
  grade: 11 | 12
  school_id: string | null
  school_name_other: string | null
  province: Province | ''
  subjects: OnboardingSubject[]
  exam_dates: { kind: 'trial' | 'final'; date: string }[]
  study_days: StudyDay[]
  study_bands: StudyBand[]
  goal: string | null
  career_interests: CareerInterest[]
}

// The form also keeps the chosen school's name for display; it is not sent.
export interface OnboardingForm extends OnboardingAnswers {
  school_name: string | null
}

export interface OnboardingDraft {
  step: number
  complete: boolean
  answers: OnboardingForm
}

export function emptyAnswers(): OnboardingForm {
  return {
    first_name: '',
    grade: 12,
    school_id: null,
    school_name: null,
    school_name_other: null,
    province: '',
    subjects: [],
    exam_dates: [],
    study_days: [],
    study_bands: [],
    goal: null,
    career_interests: [],
  }
}

export type StepProblem = 'first_name' | 'province' | 'subjects' | 'exam_order'

const isoDate = /^\d{4}-\d{2}-\d{2}$/

export function stepProblems(step: number, answers: OnboardingAnswers): StepProblem[] {
  const problems: StepProblem[] = []
  if (step === 1) {
    const name = answers.first_name.trim()
    if (name.length < 1 || name.length > 60) problems.push('first_name')
    if (!answers.province) problems.push('province')
  }
  if (step === 2 && answers.subjects.length === 0) problems.push('subjects')
  if (step === 3) {
    const trial = examDate(answers, 'trial')
    const final = examDate(answers, 'final')
    if (trial && final && trial >= final) problems.push('exam_order')
  }
  return problems
}

export function examDate(answers: OnboardingAnswers, kind: 'trial' | 'final'): string {
  return answers.exam_dates.find((entry) => entry.kind === kind)?.date ?? ''
}

export function withExamDate<T extends OnboardingAnswers>(
  answers: T,
  kind: 'trial' | 'final',
  date: string,
): T {
  const others = answers.exam_dates.filter((entry) => entry.kind !== kind)
  const exam_dates = isoDate.test(date) ? [...others, { kind, date }] : others
  exam_dates.sort((a, b) => (a.kind === 'trial' ? -1 : b.kind === 'trial' ? 1 : 0))
  return { ...answers, exam_dates }
}

// Exactly the fields save_onboarding takes, trimmed: blank optional text becomes null.
export function finalAnswers(answers: OnboardingAnswers): OnboardingAnswers {
  const other = answers.school_name_other?.trim() ?? ''
  const goal = answers.goal?.trim() ?? ''
  return {
    first_name: answers.first_name.trim(),
    grade: answers.grade,
    school_id: other ? null : answers.school_id,
    school_name_other: other || null,
    province: answers.province,
    subjects: answers.subjects.map(({ code, target_mark }) => ({ code, target_mark })),
    exam_dates: answers.exam_dates.map(({ kind, date }) => ({ kind, date })),
    study_days: [...answers.study_days],
    study_bands: [...answers.study_bands],
    goal: goal || null,
    career_interests: [...answers.career_interests],
  }
}

// NSC finals run from October, so from October the next class is the one preparing.
export function examYearFor(grade: number, today: Date): number {
  const year = today.getFullYear() + (today.getMonth() >= 9 ? 1 : 0)
  return grade === 11 ? year + 1 : year
}

export function isDraft(value: unknown): value is OnboardingDraft {
  if (!value || typeof value !== 'object') return false
  const draft = value as Partial<OnboardingDraft>
  const answers = draft.answers as Partial<OnboardingAnswers> | undefined
  return (
    typeof draft.step === 'number' &&
    typeof draft.complete === 'boolean' &&
    !!answers &&
    typeof answers.first_name === 'string' &&
    Array.isArray(answers.subjects) &&
    Array.isArray(answers.exam_dates) &&
    Array.isArray(answers.study_days) &&
    Array.isArray(answers.study_bands) &&
    Array.isArray(answers.career_interests)
  )
}
