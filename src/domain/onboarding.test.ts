import { describe, expect, it } from 'vitest'
import {
  emptyAnswers,
  examYearFor,
  finalAnswers,
  isDraft,
  stepProblems,
  withExamDate,
  type OnboardingForm,
} from './onboarding'

describe('onboarding answers', () => {
  it('needs a first name and province on step 1 and a subject on step 2', () => {
    const answers = emptyAnswers()
    expect(stepProblems(1, answers)).toEqual(['first_name', 'province'])
    expect(stepProblems(1, { ...answers, first_name: ' Thabo ', province: 'GP' })).toEqual([])
    expect(stepProblems(2, answers)).toEqual(['subjects'])
  })

  it('checks that the trial comes before the final', () => {
    let answers = withExamDate(emptyAnswers(), 'final', '2027-08-01')
    answers = withExamDate(answers, 'trial', '2027-09-01')
    expect(stepProblems(3, answers)).toEqual(['exam_order'])
    expect(answers.exam_dates.map((entry) => entry.kind)).toEqual(['trial', 'final'])
    expect(withExamDate(answers, 'trial', '').exam_dates).toEqual([
      { kind: 'final', date: '2027-08-01' },
    ])
  })

  it('sends exactly the contract fields, trimmed, without the display school name', () => {
    const form: OnboardingForm = {
      ...emptyAnswers(),
      first_name: '  Thabo ',
      province: 'GP',
      school_id: 'school-1',
      school_name: 'Demo High School',
      goal: '   ',
      subjects: [{ code: 'MATH', target_mark: 70 }],
    }
    const sent = finalAnswers(form)
    expect(Object.keys(sent).sort()).toEqual(
      [
        'career_interests',
        'exam_dates',
        'first_name',
        'goal',
        'grade',
        'province',
        'school_id',
        'school_name_other',
        'study_bands',
        'study_days',
        'subjects',
      ].sort(),
    )
    expect(sent.first_name).toBe('Thabo')
    expect(sent.goal).toBeNull()
    expect(sent.school_id).toBe('school-1')
  })

  it('uses the typed school name instead of a list school when one is given', () => {
    const sent = finalAnswers({
      ...emptyAnswers(),
      school_id: 'x',
      school_name_other: ' My School ',
    })
    expect(sent.school_id).toBeNull()
    expect(sent.school_name_other).toBe('My School')
  })

  it('picks the exam year for the class that is preparing', () => {
    expect(examYearFor(12, new Date('2026-11-23'))).toBe(2027)
    expect(examYearFor(12, new Date('2027-03-01'))).toBe(2027)
    expect(examYearFor(11, new Date('2026-11-23'))).toBe(2028)
  })

  it('recognises a stored draft and rejects anything else', () => {
    expect(isDraft({ step: 2, complete: false, answers: emptyAnswers() })).toBe(true)
    expect(isDraft({ step: 2 })).toBe(false)
    expect(isDraft('nope')).toBe(false)
  })
})
