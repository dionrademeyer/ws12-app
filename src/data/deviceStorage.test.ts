import { afterEach, describe, expect, it, vi } from 'vitest'
import { emptyAnswers } from '../domain/onboarding'
import {
  readOnboardingDraft,
  readPendingAge,
  readReturnTo,
  writeOnboardingDraft,
  writePendingAge,
  writeReturnTo,
} from './deviceStorage'

afterEach(() => vi.restoreAllMocks())

describe('device storage', () => {
  it('keeps an onboarding draft per account', () => {
    const draft = { step: 3, complete: false, answers: { ...emptyAnswers(), first_name: 'Thabo' } }
    writeOnboardingDraft('user-1', draft)
    expect(readOnboardingDraft('user-1')).toEqual(draft)
    expect(readOnboardingDraft('user-2')).toBeNull()
  })

  it('ignores a damaged draft', () => {
    window.localStorage.setItem('ws12.onboarding.user-1', '{not json')
    expect(readOnboardingDraft('user-1')).toBeNull()
  })

  it('keeps working when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() =>
      writeOnboardingDraft('user-1', { step: 1, complete: false, answers: emptyAnswers() }),
    ).not.toThrow()
    expect(readOnboardingDraft('user-1')).toBeNull()
    expect(readPendingAge()).toBeNull()
  })

  it('stores the age answer given before the account exists', () => {
    writePendingAge({ isAdult: true, isParent: true })
    expect(readPendingAge()).toEqual({ isAdult: true, isParent: true })
    writePendingAge(null)
    expect(readPendingAge()).toBeNull()
  })

  it('only returns to the parent consent page, never to another address', () => {
    writeReturnTo('/consent/123e4567-e89b')
    expect(readReturnTo()).toBe('/consent/123e4567-e89b')
    writeReturnTo('https://evil.example.com')
    expect(readReturnTo()).toBeNull()
    window.localStorage.setItem('ws12.returnTo', '//evil.example.com')
    expect(readReturnTo()).toBeNull()
  })
})
