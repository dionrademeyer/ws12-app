import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { App } from '../app/App'
import { AppError } from '../data/errors'
import {
  mockAuth,
  mockRepository,
  onboardedAdult,
  renderWithBackend,
  waitingMinor,
} from '../test/fakeBackend'

describe('the language saved to the account', () => {
  it('uses the account language after sign-in when this device has no choice', async () => {
    const repository = mockRepository({
      getAccountState: async () => ({ ...onboardedAdult, language: 'af' }),
    })
    renderWithBackend('/start', { repository })
    expect(await screen.findByRole('heading', { name: 'Hallo Thabo' })).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('af')
    expect(repository.setLanguage).not.toHaveBeenCalled()
    expect(window.localStorage.getItem('ws12.language')).toBeNull()
  })

  it('saves the choice kept on this device to the account, before consent is needed', async () => {
    window.localStorage.setItem('ws12.language', 'af')
    const repository = mockRepository({ getAccountState: async () => ({ ...waitingMinor }) })
    renderWithBackend('/start', { repository })
    expect(
      await screen.findByRole('heading', {
        name: "Voordat ons begin, moet 'n ouer of voog ja sê.",
      }),
    ).toBeInTheDocument()
    expect(repository.setLanguage).toHaveBeenCalledWith('af')
  })

  it('does not save again when the account already has the same language', async () => {
    window.localStorage.setItem('ws12.language', 'en')
    const { repository } = renderWithBackend('/start')
    expect(await screen.findByRole('heading', { name: 'Hi Thabo' })).toBeInTheDocument()
    expect(repository.setLanguage).not.toHaveBeenCalled()
  })

  it('keeps going when saving the language fails', async () => {
    window.localStorage.setItem('ws12.language', 'af')
    const repository = mockRepository()
    repository.setLanguage.mockRejectedValue(new AppError('network'))
    renderWithBackend('/start', { repository })
    expect(await screen.findByRole('heading', { name: 'Hallo Thabo' })).toBeInTheDocument()
    expect(repository.setLanguage).toHaveBeenCalledWith('af')
  })

  it('saves a change made with the language switch while signed in', async () => {
    const user = userEvent.setup()
    const repository = mockRepository()
    repository.setLanguage.mockRejectedValue(new AppError('network'))
    renderWithBackend('/app/settings', { repository })
    await user.click(await screen.findByRole('button', { name: 'Afrikaans' }))
    expect(repository.setLanguage).toHaveBeenCalledWith('af')
    expect(await screen.findByRole('heading', { name: 'Instellings' })).toBeInTheDocument()
    expect(window.localStorage.getItem('ws12.language')).toBe('af')

    await user.click(screen.getByRole('button', { name: 'Afrikaans' }))
    expect(repository.setLanguage).toHaveBeenCalledTimes(1)
  })

  it('keeps the choice on the device only when signed out', async () => {
    const user = userEvent.setup()
    const repository = mockRepository()
    renderWithBackend('/', { repository, auth: mockAuth(null) })
    await user.click(await screen.findByRole('button', { name: 'Afrikaans' }))
    expect(window.localStorage.getItem('ws12.language')).toBe('af')
    expect(repository.setLanguage).not.toHaveBeenCalled()
  })

  it('switches the language in the demo, which has no account to save to', async () => {
    const user = userEvent.setup()
    window.sessionStorage.setItem('ws12.demo', 'on')
    render(<App initialPath="/app/settings" />)
    await user.click(await screen.findByRole('button', { name: 'Afrikaans' }))
    await waitFor(() => expect(document.documentElement.lang).toBe('af'))
  })
})
