import { describe, expect, it } from 'vitest'
import type { AccountState } from '../data/learner'
import { canSaveLearnerData, nextAccountPath } from './accountRouting'

const base: AccountState = {
  isAdult: true,
  consentStatus: 'not_needed',
  roles: ['learner'],
  onboardingStep: 0,
  onboarded: false,
  language: 'en',
}

describe('routing after sign-in', () => {
  it('asks the age question first when it is unanswered', () => {
    expect(nextAccountPath({ ...base, isAdult: null, consentStatus: 'none' })).toBe('/start/age')
  })

  it.each(['none', 'pending', 'withdrawn'] as const)(
    'sends a minor with consent %s to the consent screen',
    (consentStatus) => {
      expect(nextAccountPath({ ...base, isAdult: false, consentStatus })).toBe('/start/consent')
    },
  )

  it('sends a minor with consent, or an adult, to onboarding when not onboarded', () => {
    expect(nextAccountPath({ ...base, isAdult: false, consentStatus: 'given' })).toBe(
      '/start/onboarding',
    )
    expect(nextAccountPath(base)).toBe('/start/onboarding')
  })

  it('opens the dashboard once onboarded', () => {
    expect(nextAccountPath({ ...base, onboarded: true })).toBe('/app/dashboard')
  })

  it('sends a parent to Family instead of learner onboarding', () => {
    expect(nextAccountPath({ ...base, roles: ['learner', 'parent'] })).toBe('/app/family')
  })

  it('returns an adult to the consent page they came from, never a minor', () => {
    expect(nextAccountPath(base, '/consent/abc')).toBe('/consent/abc')
    expect(
      nextAccountPath({ ...base, isAdult: false, consentStatus: 'given' }, '/consent/abc'),
    ).toBe('/start/onboarding')
  })

  it('only lets adults or consented minors save learner data', () => {
    expect(canSaveLearnerData(base)).toBe(true)
    expect(canSaveLearnerData({ ...base, isAdult: false, consentStatus: 'pending' })).toBe(false)
    expect(canSaveLearnerData({ ...base, isAdult: false, consentStatus: 'given' })).toBe(true)
    expect(canSaveLearnerData({ ...base, isAdult: null, consentStatus: 'given' })).toBe(true)
  })
})
