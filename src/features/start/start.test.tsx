import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { writeOnboardingDraft, writePendingAge, writeReturnTo } from '../../data/deviceStorage'
import { AppError } from '../../data/errors'
import { emptyAnswers } from '../../domain/onboarding'
import {
  mockRepository,
  onboardedAdult,
  renderWithBackend,
  testUser,
  waitingMinor,
} from '../../test/fakeBackend'

describe('account check after sign-in', () => {
  it('asks the age question when it is unanswered, then routes on', async () => {
    const user = userEvent.setup()
    let declared: boolean | null = null
    const repository = mockRepository({
      getAccountState: async () =>
        declared === null
          ? { ...onboardedAdult, isAdult: null, consentStatus: 'none' }
          : { ...onboardedAdult, isAdult: declared },
      declareAge: async (isAdult) => {
        declared = isAdult
      },
    })
    renderWithBackend('/start', { repository })
    expect(await screen.findByRole('heading', { name: 'One quick question' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(screen.getByText('Choose Yes or No.')).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Yes' }))
    await user.click(screen.getByRole('checkbox', { name: /I'm a parent/ }))
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(await screen.findByRole('heading', { name: 'Hi Thabo' })).toBeInTheDocument()
    expect(repository.declareAge).toHaveBeenCalledWith(true)
    expect(repository.claimParentRole).toHaveBeenCalled()
  })

  it('applies the age answer from Register once the account exists', async () => {
    writePendingAge({ isAdult: false, isParent: false })
    let declared = false
    const repository = mockRepository({
      getAccountState: async () =>
        declared ? { ...waitingMinor } : { ...waitingMinor, isAdult: null },
      declareAge: async () => {
        declared = true
      },
    })
    renderWithBackend('/start', { repository })
    expect(
      await screen.findByRole('heading', {
        name: 'Before we start, a parent or guardian needs to say yes.',
      }),
    ).toBeInTheDocument()
    expect(repository.declareAge).toHaveBeenCalledTimes(1)
    expect(repository.declareAge).toHaveBeenCalledWith(false)
    expect(repository.claimParentRole).not.toHaveBeenCalled()
    expect(window.localStorage.getItem('ws12.pendingAge')).toBeNull()
  })

  it('sends a learner who is not onboarded to onboarding', async () => {
    const repository = mockRepository({
      getAccountState: async () => ({ ...onboardedAdult, onboarded: false }),
    })
    renderWithBackend('/start', { repository })
    expect(await screen.findByText('STEP 1 OF 5')).toBeInTheDocument()
  })

  it('sends answers kept on the device once consent exists, then shows the first-time welcome', async () => {
    writeOnboardingDraft(testUser.id, {
      step: 5,
      complete: true,
      answers: {
        ...emptyAnswers(),
        first_name: 'Thabo',
        province: 'GP',
        school_name: 'Shown only',
        subjects: [{ code: 'MATH', target_mark: 70 }],
      },
    })
    let onboarded = false
    const repository = mockRepository({
      getAccountState: async () => ({ ...waitingMinor, consentStatus: 'given', onboarded }),
      saveOnboarding: async () => {
        onboarded = true
      },
    })
    renderWithBackend('/start', { repository })
    expect(
      await screen.findByRole('heading', { name: 'Welcome to WS12, Thabo' }),
    ).toBeInTheDocument()
    const sent = repository.saveOnboarding.mock.calls[0]?.[0]
    expect(sent).toMatchObject({
      first_name: 'Thabo',
      subjects: [{ code: 'MATH', target_mark: 70 }],
    })
    expect(sent).not.toHaveProperty('school_name')
    expect(window.localStorage.getItem(`ws12.onboarding.${testUser.id}`)).toBeNull()
  })

  it('keeps the answers and offers Retry when sending them fails', async () => {
    const user = userEvent.setup()
    writeOnboardingDraft(testUser.id, {
      step: 5,
      complete: true,
      answers: { ...emptyAnswers(), first_name: 'Thabo', province: 'GP' },
    })
    const repository = mockRepository({
      getAccountState: async () => ({ ...waitingMinor, consentStatus: 'given' }),
      saveOnboarding: async () => {
        throw new AppError('invalid_input')
      },
    })
    renderWithBackend('/start', { repository })
    expect(
      await screen.findByRole('heading', { name: "We couldn't save your answers yet." }),
    ).toBeInTheDocument()
    expect(window.localStorage.getItem(`ws12.onboarding.${testUser.id}`)).not.toBeNull()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(repository.saveOnboarding).toHaveBeenCalledTimes(2))
  })

  it('returns an adult to the parent consent page after signing in', async () => {
    writeReturnTo('/consent/consent-1')
    renderWithBackend('/start')
    expect(
      await screen.findByRole('heading', { name: 'Thabo asked for your consent' }),
    ).toBeInTheDocument()
    expect(window.localStorage.getItem('ws12.returnTo')).toBeNull()
  })

  it('shows an error with Retry when the account cannot be read', async () => {
    const user = userEvent.setup()
    let fail = true
    const repository = mockRepository({
      getAccountState: async () => {
        if (fail) throw new AppError('network')
        return { ...onboardedAdult }
      },
    })
    renderWithBackend('/start', { repository })
    expect(await screen.findByRole('alert')).toHaveTextContent('No connection.')
    fail = false
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { name: 'Hi Thabo' })).toBeInTheDocument()
  })
})
