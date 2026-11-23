import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { readOnboardingDraft } from '../../data/deviceStorage'
import { AppError } from '../../data/errors'
import {
  mockRepository,
  onboardedAdult,
  renderWithBackend,
  testUser,
  waitingMinor,
} from '../../test/fakeBackend'

const newAdult = { ...onboardedAdult, onboarded: false, onboardingStep: 0 }

async function fillStepOne(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText('First name'), 'Thabo')
  await user.selectOptions(screen.getByLabelText('Province'), 'GP')
}

describe('onboarding', () => {
  it('shows STEP n OF 5 with an accessible progress bar and Back', async () => {
    const user = userEvent.setup()
    const repository = mockRepository({ getAccountState: async () => newAdult })
    renderWithBackend('/start/onboarding', { repository })

    expect(await screen.findByText('STEP 1 OF 5')).toBeInTheDocument()
    const progress = screen.getByRole('progressbar', { name: 'Setup progress' })
    expect(progress).toHaveAttribute('aria-valuenow', '1')
    expect(progress).toHaveAttribute('aria-valuemax', '5')
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Enter your first name.')).toBeInTheDocument()
    expect(screen.getByText('Choose your province.')).toBeInTheDocument()

    await fillStepOne(user)
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('STEP 2 OF 5')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2')

    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByText('STEP 1 OF 5')).toBeInTheDocument()
    expect(screen.getByLabelText('First name')).toHaveValue('Thabo')
  })

  it('suggests Life Orientation and a home language, and sets targets with a slider', async () => {
    const user = userEvent.setup()
    const repository = mockRepository({ getAccountState: async () => newAdult })
    renderWithBackend('/start/onboarding', { repository })
    await fillStepOne(user)
    await user.click(screen.getByRole('button', { name: 'Next' }))

    expect(screen.getByRole('checkbox', { name: /Life Orientation/ })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /English Home Language/ })).toBeChecked()
    expect(screen.getAllByText('Suggested')).toHaveLength(2)

    await user.click(screen.getByRole('checkbox', { name: /^Mathematics$/ }))
    await user.click(screen.getByRole('button', { name: 'Add a target for Mathematics' }))
    expect(screen.getByRole('slider', { name: 'Target for Mathematics' })).toHaveValue('60')
  })

  it('saves each step on the device and resumes there', async () => {
    const user = userEvent.setup()
    const repository = mockRepository({ getAccountState: async () => newAdult })
    const first = renderWithBackend('/start/onboarding', { repository })
    await fillStepOne(user)
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(readOnboardingDraft(testUser.id)?.step).toBe(2))
    first.unmount()

    renderWithBackend('/start/onboarding', { repository })
    expect(await screen.findByText('STEP 2 OF 5')).toBeInTheDocument()
    expect(readOnboardingDraft(testUser.id)?.answers.first_name).toBe('Thabo')
  })

  it('prefills exam dates with the provisional note', async () => {
    const user = userEvent.setup()
    const repository = mockRepository({ getAccountState: async () => newAdult })
    renderWithBackend('/start/onboarding', { repository })
    await fillStepOne(user)
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: 'Next' }))

    expect(await screen.findByLabelText('Trial exams start')).toHaveValue('2027-08-23')
    expect(screen.getByLabelText('Final exams start')).toHaveValue('2027-10-25')
    expect(
      screen.getByText('Provisional until the official timetable is published.'),
    ).toBeInTheDocument()
    expect(repository.getExamCalendar).toHaveBeenCalled()
  })

  it('sends the answers with Start my journey when the account can save them', async () => {
    const user = userEvent.setup()
    let onboarded = false
    const repository = mockRepository({
      getAccountState: async () => ({ ...newAdult, onboarded }),
      saveOnboarding: async () => {
        onboarded = true
      },
    })
    renderWithBackend('/start/onboarding', { repository })
    await fillStepOne(user)
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByDisplayValue('2027-08-23')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('checkbox', { name: /^Mon/ }))
    await user.click(screen.getByRole('checkbox', { name: /^Evening/ }))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('STEP 5 OF 5')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'Pass all my subjects' }))
    await user.click(screen.getByRole('checkbox', { name: 'Engineering' }))
    await user.click(screen.getByRole('button', { name: 'Start my journey' }))

    expect(
      await screen.findByRole('heading', { name: 'Welcome to WS12, Thabo' }),
    ).toBeInTheDocument()
    expect(repository.saveOnboarding).toHaveBeenCalledWith({
      first_name: 'Thabo',
      grade: 12,
      school_id: null,
      school_name_other: null,
      province: 'GP',
      subjects: [
        { code: 'LO', target_mark: null },
        { code: 'ENHL', target_mark: null },
      ],
      exam_dates: [
        { kind: 'trial', date: '2027-08-23' },
        { kind: 'final', date: '2027-10-25' },
      ],
      study_days: ['mon'],
      study_bands: ['evening'],
      goal: 'Pass all my subjects',
      career_interests: ['engineering'],
    })
    expect(readOnboardingDraft(testUser.id)).toBeNull()
  })

  it('keeps the answers on the device for a learner waiting for consent', async () => {
    const user = userEvent.setup()
    const repository = mockRepository({
      getAccountState: async () => ({ ...waitingMinor, consentStatus: 'pending' }),
    })
    renderWithBackend('/start/onboarding', { repository })
    expect(
      await screen.findByText('Your answers stay on this device until your parent says yes.'),
    ).toBeInTheDocument()
    await fillStepOne(user)
    for (let step = 1; step < 5; step++) {
      await user.click(screen.getByRole('button', { name: 'Next' }))
    }
    await user.click(screen.getByRole('button', { name: 'Start my journey' }))

    expect(await screen.findByRole('heading', { name: 'Saved on this device' })).toBeInTheDocument()
    expect(repository.saveOnboarding).not.toHaveBeenCalled()
    expect(readOnboardingDraft(testUser.id)?.complete).toBe(true)
  })

  it('keeps the answers and offers Try again when saving fails', async () => {
    const user = userEvent.setup()
    const repository = mockRepository({
      getAccountState: async () => newAdult,
      saveOnboarding: async () => {
        throw new AppError('network')
      },
    })
    renderWithBackend('/start/onboarding', { repository })
    await fillStepOne(user)
    for (let step = 1; step < 5; step++) {
      await user.click(screen.getByRole('button', { name: 'Next' }))
    }
    await user.click(screen.getByRole('button', { name: 'Start my journey' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Your answers are still here.')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(readOnboardingDraft(testUser.id)?.answers.first_name).toBe('Thabo')
  })

  it('lets the learner pick a school from the list or type one that is not listed', async () => {
    const user = userEvent.setup()
    const repository = mockRepository({ getAccountState: async () => newAdult })
    renderWithBackend('/start/onboarding', { repository })
    await fillStepOne(user)
    await user.type(screen.getByRole('searchbox', { name: 'School' }), 'Demo')
    await user.click(await screen.findByRole('button', { name: 'Demo High School' }))
    expect(screen.getByText('Demo High School')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Change' }))
    await user.click(screen.getByRole('checkbox', { name: "My school isn't listed" }))
    const typed = screen.getByLabelText('School name')
    expect(typed).toHaveValue('Demo')
    await user.clear(typed)
    await user.type(typed, 'Hill Top School')
    await waitFor(() =>
      expect(readOnboardingDraft(testUser.id)?.answers.school_name_other).toBe('Hill Top School'),
    )
  })
})
