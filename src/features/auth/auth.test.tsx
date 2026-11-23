import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../app/App'
import { AppError } from '../../data/errors'
import { mockAuth, mockRepository, renderWithBackend, testUser } from '../../test/fakeBackend'

afterEach(() => {
  vi.useRealTimers()
})

describe('welcome screen', () => {
  it('explains that sign-in is not set up when there is no Supabase project', async () => {
    const user = userEvent.setup()
    render(<App initialPath="/" />)
    await user.click(screen.getByRole('button', { name: 'Continue with Google' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Sign-in is not set up yet.')
    await user.click(screen.getByRole('button', { name: 'Continue with Email' }))
    expect(screen.getByRole('button', { name: 'Try the demo' })).toBeEnabled()
    expect(screen.getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/signin')
    expect(screen.getByRole('link', { name: 'Register' })).toHaveAttribute('href', '/register')
    expect(screen.getByText('Based on the book by Melvin Monroe Tobias.')).toBeInTheDocument()
  })

  it('starts Google sign-in with the callback address', async () => {
    const user = userEvent.setup()
    const { auth } = renderWithBackend('/', { user: null })
    await user.click(await screen.findByRole('button', { name: 'Continue with Google' }))
    expect(auth.signInWithProvider).toHaveBeenCalledWith(
      'google',
      `${window.location.origin}/auth/callback`,
    )
  })

  it('shows a message under the Google button when Google fails, and keeps email available', async () => {
    const user = userEvent.setup()
    const auth = mockAuth(null)
    auth.signInWithProvider.mockRejectedValueOnce(new AppError('unknown'))
    renderWithBackend('/', { auth })
    await user.click(await screen.findByRole('button', { name: 'Continue with Google' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("Google sign-in didn't work.")
    expect(screen.getByRole('button', { name: 'Continue with Email' })).toBeEnabled()
  })

  it('shows the Google error after a failed return from Google', async () => {
    renderWithBackend('/auth/callback?error=access_denied', { user: null })
    expect(await screen.findByRole('alert')).toHaveTextContent("Google sign-in didn't work.")
  })

  it('tells the learner when they are offline', async () => {
    const onLine = vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false)
    render(<App initialPath="/" />)
    expect(screen.getByText("You're offline. Connect to sign in.")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeDisabled()
    onLine.mockRestore()
  })
})

describe('sign in', () => {
  it('signs in with email and routes through the account check to the dashboard', async () => {
    const user = userEvent.setup()
    const { auth, repository } = renderWithBackend('/signin', { user: null })
    await user.type(await screen.findByLabelText('Email'), 'learner@example.com')
    await user.type(screen.getByLabelText('Password'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('heading', { name: 'Hi Thabo' })).toBeInTheDocument()
    expect(auth.signInWithEmail).toHaveBeenCalledWith('learner@example.com', 'secret123')
    expect(repository.claimEntitlements).toHaveBeenCalledTimes(1)
  })

  it('shows a clear message for a wrong password', async () => {
    const user = userEvent.setup()
    const auth = mockAuth(null)
    auth.signInWithEmail.mockRejectedValueOnce(new AppError('invalid_credentials'))
    renderWithBackend('/signin', { auth })
    await user.type(await screen.findByLabelText('Email'), 'learner@example.com')
    await user.type(screen.getByLabelText('Password'), 'nope')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That email or password is not right.',
    )
  })

  it('opens the verification screen when the email is not confirmed yet', async () => {
    const user = userEvent.setup()
    const auth = mockAuth(null)
    auth.signInWithEmail.mockRejectedValueOnce(new AppError('email_not_verified'))
    renderWithBackend('/signin', { auth })
    await user.type(await screen.findByLabelText('Email'), 'learner@example.com')
    await user.type(screen.getByLabelText('Password'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument()
    expect(screen.getByText(/learner@example.com/)).toBeInTheDocument()
  })

  it('offers Forgot password and the parent path', async () => {
    renderWithBackend('/signin', { user: null })
    expect(await screen.findByRole('link', { name: 'Forgot password?' })).toHaveAttribute(
      'href',
      '/forgot-password',
    )
    expect(screen.getByRole('link', { name: "I'm a parent" })).toHaveAttribute(
      'href',
      '/register?parent=1',
    )
  })

  it('shows the not set up message instead of the form without Supabase', async () => {
    render(<App initialPath="/signin" />)
    expect(await screen.findByText(/Sign-in is not set up yet/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Password')).toBeNull()
    expect(screen.getByRole('button', { name: 'Try the demo' })).toBeInTheDocument()
  })
})

describe('register', () => {
  it('needs the age answer and only allows the parent path with Yes', async () => {
    const user = userEvent.setup()
    const { auth } = renderWithBackend('/register', { user: null })
    const parent = await screen.findByRole('checkbox', { name: /I'm a parent/ })
    expect(parent).toBeDisabled()

    await user.type(screen.getByLabelText('Email'), 'learner@example.com')
    await user.type(screen.getByLabelText(/^Password/), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(screen.getByText('Choose Yes or No.')).toBeInTheDocument()
    expect(auth.signUpWithEmail).not.toHaveBeenCalled()

    await user.click(screen.getByRole('radio', { name: 'Yes' }))
    expect(parent).toBeEnabled()
    await user.click(parent)
    await user.click(screen.getByRole('radio', { name: 'No' }))
    expect(parent).toBeDisabled()
    expect(parent).not.toBeChecked()
  })

  it('creates the account, keeps the age answer and asks to verify the email', async () => {
    const user = userEvent.setup()
    const { auth } = renderWithBackend('/register', { user: null })
    await user.click(await screen.findByRole('radio', { name: 'No' }))
    await user.type(screen.getByLabelText('Email'), 'learner@example.com')
    await user.type(screen.getByLabelText(/^Password/), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument()
    expect(auth.signUpWithEmail).toHaveBeenCalledWith(
      'learner@example.com',
      'secret123',
      `${window.location.origin}/auth/callback`,
      'en',
    )
    expect(window.localStorage.getItem('ws12.pendingAge')).toBe('minor')
  })

  it('validates the email and password', async () => {
    const user = userEvent.setup()
    renderWithBackend('/register', { user: null })
    await user.click(await screen.findByRole('radio', { name: 'Yes' }))
    await user.type(screen.getByLabelText('Email'), 'not-an-email')
    await user.type(screen.getByLabelText(/^Password/), 'short')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument()
    expect(screen.getByText('Use a longer password.')).toBeInTheDocument()
  })

  it('suggests signing in when the email already has an account', async () => {
    const user = userEvent.setup()
    const auth = mockAuth(null)
    auth.signUpWithEmail.mockRejectedValueOnce(new AppError('email_taken'))
    renderWithBackend('/register', { auth })
    await user.click(await screen.findByRole('radio', { name: 'Yes' }))
    await user.type(screen.getByLabelText('Email'), 'learner@example.com')
    await user.type(screen.getByLabelText(/^Password/), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('That email already has an account.')
    expect(screen.getByRole('link', { name: 'Sign in instead?' })).toBeInTheDocument()
  })

  it('preselects the parent path from a parent link and keeps an invite code', async () => {
    renderWithBackend('/register?parent=1&invite=ABCD2345', { user: null })
    expect(await screen.findByRole('checkbox', { name: /I'm a parent/ })).toBeChecked()
    expect(window.localStorage.getItem('ws12.pendingInvite')).toBe('ABCD2345')
  })
})

describe('email verification', () => {
  it('enables Resend email after 60 seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const auth = mockAuth(null)
    auth.signInWithEmail.mockRejectedValueOnce(new AppError('email_not_verified'))
    renderWithBackend('/signin', { auth })
    await user.type(await screen.findByLabelText('Email'), 'learner@example.com')
    await user.type(screen.getByLabelText('Password'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    const resend = await screen.findByRole('button', { name: /Resend email in/ })
    expect(resend).toBeDisabled()
    for (let second = 0; second < 60; second++) {
      act(() => vi.advanceTimersByTime(1000))
    }
    const ready = await screen.findByRole('button', { name: 'Resend email' })
    expect(ready).toBeEnabled()
    await user.click(ready)
    expect(auth.resendVerification).toHaveBeenCalledWith(
      'learner@example.com',
      `${window.location.origin}/auth/callback`,
    )
    expect(await screen.findByText('Sent. Check your inbox again.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Resend email in/ })).toBeDisabled()
  })
})

describe('password reset', () => {
  it('sends a reset link', async () => {
    const user = userEvent.setup()
    const { auth } = renderWithBackend('/forgot-password', { user: null })
    await user.type(await screen.findByLabelText('Email'), 'learner@example.com')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))
    expect(await screen.findByText(/a reset link is on its way/)).toBeInTheDocument()
    expect(auth.sendPasswordReset).toHaveBeenCalledWith(
      'learner@example.com',
      `${window.location.origin}/reset-password`,
    )
  })

  it('changes the password from the reset link', async () => {
    const user = userEvent.setup()
    const { auth } = renderWithBackend('/reset-password', { user: testUser })
    await user.type(await screen.findByLabelText(/^New password/), 'newsecret1')
    await user.type(screen.getByLabelText('Type it again'), 'different1')
    await user.click(screen.getByRole('button', { name: 'Save new password' }))
    expect(screen.getByText("The passwords don't match.")).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Type it again'))
    await user.type(screen.getByLabelText('Type it again'), 'newsecret1')
    await user.click(screen.getByRole('button', { name: 'Save new password' }))
    expect(await screen.findByText('Your password is changed.')).toBeInTheDocument()
    expect(auth.updatePassword).toHaveBeenCalledWith('newsecret1')
  })

  it('explains an expired reset link', async () => {
    renderWithBackend('/reset-password', { user: null })
    expect(await screen.findByText(/This reset link has expired/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Get a new link' })).toHaveAttribute(
      'href',
      '/forgot-password',
    )
  })
})

describe('session', () => {
  it('sends a signed-in person from Welcome through the account check', async () => {
    const { repository } = renderWithBackend('/')
    expect(await screen.findByRole('heading', { name: 'Hi Thabo' })).toBeInTheDocument()
    expect(repository.getAccountState).toHaveBeenCalled()
  })

  it('finishes a Google return on the callback route', async () => {
    renderWithBackend('/auth/callback')
    expect(await screen.findByRole('heading', { name: 'Hi Thabo' })).toBeInTheDocument()
  })

  it('keeps the app shell closed to a signed-out visitor', async () => {
    renderWithBackend('/app/profile', { user: null })
    expect(await screen.findByRole('button', { name: 'Try the demo' })).toBeInTheDocument()
  })

  it('claims purchases only once per sign-in', async () => {
    const repository = mockRepository()
    const { unmount } = renderWithBackend('/start', { repository })
    await screen.findByRole('heading', { name: 'Hi Thabo' })
    await waitFor(() => expect(repository.claimEntitlements).toHaveBeenCalledTimes(1))
    unmount()
  })
})
