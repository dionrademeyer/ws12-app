import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { App } from '../../app/App'
import { AppError } from '../../data/errors'
import { mockRepository, renderWithBackend, waitingMinor } from '../../test/fakeBackend'

const consentTitle = 'Before we start, a parent or guardian needs to say yes.'

describe('consent for a learner under 18', () => {
  it('shows both options and what parents see', async () => {
    const repository = mockRepository({ getAccountState: async () => ({ ...waitingMinor }) })
    renderWithBackend('/start/consent', { repository })
    expect(await screen.findByRole('heading', { name: consentTitle })).toBeInTheDocument()
    expect(
      screen.getByText(
        'Your parent sees a short weekly summary, not your private chats or answers.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Send my parent a link' })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'My parent already has a WS12 account' }),
    ).toBeInTheDocument()
  })

  it('sends a link to the parent and waits, with Resend and Change contact', async () => {
    const user = userEvent.setup()
    const repository = mockRepository({ getAccountState: async () => ({ ...waitingMinor }) })
    renderWithBackend('/start/consent', { repository })
    await user.type(await screen.findByLabelText("Your parent's email"), 'mom@example.com')
    await user.click(screen.getByRole('button', { name: 'Send my parent a link' }))

    expect(
      await screen.findByRole('heading', { name: 'Waiting for your parent' }),
    ).toBeInTheDocument()
    expect(repository.requestConsent).toHaveBeenCalledWith('mom@example.com')
    expect(screen.getByText(/Send your parent this link so they can say yes/)).toBeInTheDocument()
    const share = screen.getByRole('link', { name: 'Share on WhatsApp' }).getAttribute('href') ?? ''
    expect(decodeURIComponent(share)).toContain('/consent/demo-consent-request')

    await user.click(screen.getByRole('button', { name: 'Resend' }))
    expect(
      await screen.findByText('Your request is ready again. Share the link with your parent.'),
    ).toBeInTheDocument()
    expect(repository.requestConsent).toHaveBeenCalledTimes(2)

    await user.click(screen.getByRole('button', { name: 'Change contact' }))
    expect(screen.getByLabelText("Your parent's email")).toHaveValue('mom@example.com')
  })

  it('says the parent was emailed once sending is switched on', async () => {
    const user = userEvent.setup()
    const repository = mockRepository({
      getAccountState: async () => ({ ...waitingMinor }),
      requestConsent: async () => ({ consentId: 'consent-2', sent: true }),
    })
    renderWithBackend('/start/consent', { repository })
    await user.type(await screen.findByLabelText("Your parent's email"), 'mom@example.com')
    await user.click(screen.getByRole('button', { name: 'Send my parent a link' }))
    expect(await screen.findByText(/We asked your parent to say yes/)).toBeInTheDocument()
  })

  it('opens the waiting state for a request that is already pending', async () => {
    const repository = mockRepository({
      getAccountState: async () => ({ ...waitingMinor, consentStatus: 'pending' }),
    })
    renderWithBackend('/start/consent', { repository })
    expect(
      await screen.findByRole('heading', { name: 'Waiting for your parent' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Set up my profile' })).toBeInTheDocument()
  })

  it('checks the email address before sending', async () => {
    const user = userEvent.setup()
    const repository = mockRepository({ getAccountState: async () => ({ ...waitingMinor }) })
    renderWithBackend('/start/consent', { repository })
    await user.type(await screen.findByLabelText("Your parent's email"), 'mom')
    await user.click(screen.getByRole('button', { name: 'Send my parent a link' }))
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument()
    expect(repository.requestConsent).not.toHaveBeenCalled()
  })

  it('redeems a parent invite code, and explains a wrong code or too many tries', async () => {
    const user = userEvent.setup()
    const repository = mockRepository({
      getAccountState: async () => ({ ...waitingMinor }),
    })
    repository.redeemInvite
      .mockRejectedValueOnce(new AppError('invalid_code'))
      .mockRejectedValueOnce(new AppError('rate_limited'))
      .mockResolvedValueOnce('link-1')
    renderWithBackend('/start/consent', { repository })

    const code = await screen.findByLabelText('Invite code')
    await user.type(code, 'abcd2345')
    await user.click(screen.getByRole('button', { name: 'Use code' }))
    expect(
      await screen.findByText("That code didn't work. Check it or ask for a new one."),
    ).toBeInTheDocument()
    expect(repository.redeemInvite).toHaveBeenCalledWith('ABCD2345')

    await user.click(screen.getByRole('button', { name: 'Use code' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Please wait a while and try again.')

    await user.click(screen.getByRole('button', { name: 'Use code' }))
    expect(await screen.findByText(/Ask your parent to open WS12 and accept/)).toBeInTheDocument()
  })

  it('moves on once the parent has said yes', async () => {
    const user = userEvent.setup()
    let given = false
    const repository = mockRepository({
      getAccountState: async () => ({
        ...waitingMinor,
        consentStatus: given ? 'given' : 'pending',
        onboarded: given,
      }),
    })
    renderWithBackend('/start/consent', { repository })
    await screen.findByRole('heading', { name: 'Waiting for your parent' })
    given = true
    await user.click(screen.getByRole('button', { name: 'Check again' }))
    expect(await screen.findByRole('heading', { name: 'Hi Thabo' })).toBeInTheDocument()
  })
})

describe('parent consent page', () => {
  it('asks a signed-out parent to sign in and remembers the page', async () => {
    const user = userEvent.setup()
    renderWithBackend('/consent/consent-1', { user: null })
    expect(
      await screen.findByRole('heading', { name: 'A learner asked for your consent' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Create a parent account' }))
    expect(window.localStorage.getItem('ws12.returnTo')).toBe('/consent/consent-1')
    expect(await screen.findByRole('checkbox', { name: /I'm a parent/ })).toBeChecked()
  })

  it('says sign-in is not set up when there is no Supabase project', async () => {
    render(<App initialPath="/consent/consent-1" />)
    expect(await screen.findByText(/Sign-in is not set up yet/)).toBeInTheDocument()
  })

  it('shows who, what, why and how to withdraw, then records consent', async () => {
    const user = userEvent.setup()
    const { repository } = renderWithBackend('/consent/consent-1')
    expect(
      await screen.findByRole('heading', { name: 'Thabo asked for your consent' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'What WS12 keeps' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Why' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'How to withdraw' })).toBeInTheDocument()
    expect(screen.getByText(/Asked on 20 November 2026/)).toBeInTheDocument()
    expect(screen.getByText(/A short weekly summary of your child's study/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'I give consent' }))
    expect(await screen.findByText(/Thabo can now use WS12/)).toBeInTheDocument()
    expect(repository.getConsentRequest).toHaveBeenCalledWith('consent-1')
    expect(repository.claimParentRole).toHaveBeenCalledTimes(1)
    expect(repository.giveConsent).toHaveBeenCalledWith('consent-1')
  })

  it('confirms before closing a request that is not for their child', async () => {
    const user = userEvent.setup()
    const { repository } = renderWithBackend('/consent/consent-1')
    await user.click(await screen.findByRole('button', { name: 'This is not my child' }))
    const dialog = screen.getByRole('alertdialog', { name: 'Close this request?' })
    await user.click(within(dialog).getByRole('button', { name: 'This is not my child' }))
    expect(
      await screen.findByText('We closed this request and deleted your contact details.'),
    ).toBeInTheDocument()
    expect(repository.declineConsent).toHaveBeenCalledWith('consent-1')
  })

  it('explains a request sent to a different email', async () => {
    const repository = mockRepository({
      getConsentRequest: async () => {
        throw new AppError('contact_mismatch')
      },
    })
    renderWithBackend('/consent/consent-1', { repository })
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This request was sent to a different email address.',
    )
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('explains an expired consent when saying yes', async () => {
    const user = userEvent.setup()
    const repository = mockRepository({
      giveConsent: async () => {
        throw new AppError('consent_expired')
      },
    })
    renderWithBackend('/consent/consent-1', { repository })
    await user.click(await screen.findByRole('button', { name: 'I give consent' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('This request has expired.')
  })
})
