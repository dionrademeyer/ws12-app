import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { App } from '../app/App'
import { AppError } from '../data/errors'
import {
  mockRepository,
  onboardedAdult,
  renderWithBackend,
  waitingMinor,
} from '../test/fakeBackend'

describe('the app respects the account state', () => {
  it('sends a minor without consent to the consent step instead of the dashboard', async () => {
    const repository = mockRepository({ getAccountState: async () => ({ ...waitingMinor }) })
    renderWithBackend('/app/dashboard', { repository })
    expect(
      await screen.findByRole('heading', {
        name: 'Before we start, a parent or guardian needs to say yes.',
      }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Hi Thabo' })).toBeNull()
  })

  it('asks the age question first when it is unanswered', async () => {
    const repository = mockRepository({
      getAccountState: async () => ({ ...onboardedAdult, isAdult: null, consentStatus: 'none' }),
    })
    renderWithBackend('/app/profile', { repository })
    expect(await screen.findByRole('heading', { name: 'One quick question' })).toBeInTheDocument()
  })

  it('sends an account that is not onboarded to onboarding', async () => {
    const repository = mockRepository({
      getAccountState: async () => ({ ...onboardedAdult, onboarded: false }),
    })
    renderWithBackend('/app/family', { repository })
    expect(await screen.findByText('STEP 1 OF 5')).toBeInTheDocument()
  })

  it('lets a parent who is not onboarded use the app, starting in Family', async () => {
    const repository = mockRepository({
      getAccountState: async () => ({
        ...onboardedAdult,
        onboarded: false,
        roles: ['learner', 'parent'],
      }),
      getFamily: async () => [],
    })
    renderWithBackend('/app/family', { repository })
    expect(
      await screen.findByRole('heading', { name: 'Invite your child to get started.' }),
    ).toBeInTheDocument()
  })

  it('opens the dashboard for an onboarded account', async () => {
    renderWithBackend('/app/dashboard')
    expect(await screen.findByRole('heading', { name: 'Hi Thabo' })).toBeInTheDocument()
  })

  it('shows an error with Retry when the account state cannot load', async () => {
    const user = userEvent.setup()
    const repository = mockRepository()
    repository.getAccountState.mockRejectedValueOnce(new AppError('network'))
    renderWithBackend('/app/dashboard', { repository })
    expect(
      await screen.findByRole('heading', { name: "We couldn't open your account." }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { name: 'Hi Thabo' })).toBeInTheDocument()
  })

  it('leaves the demo unchanged', async () => {
    window.sessionStorage.setItem('ws12.demo', 'on')
    render(<App initialPath="/app/dashboard" />)
    expect(await screen.findByRole('heading', { name: /Thabo/ })).toBeInTheDocument()
  })
})
