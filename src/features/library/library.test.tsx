import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../app/App'
import { AppError } from '../../data/errors'
import type { LibraryItem } from '../../data/learner'
import { mockRepository, renderWithBackend } from '../../test/fakeBackend'
import { startDownload } from '../../ui/download'

vi.mock('../../ui/download', async (original) => ({
  ...(await original<typeof import('../../ui/download')>()),
  startDownload: vi.fn(),
}))

beforeEach(() => vi.mocked(startDownload).mockClear())

const planner: LibraryItem = {
  fileId: 'planner-1',
  kind: 'planner',
  language: 'en',
  title: { en: 'Weekly planner', af: 'Weeklikse beplanner' },
  sizeBytes: 420_000,
  minTier: 'free',
  unlocked: true,
}

const lockedBook: LibraryItem = {
  fileId: 'book-en',
  kind: 'book',
  language: 'en',
  title: { en: 'Winning Strategies for Grade 12', af: 'Winning Strategies for Grade 12' },
  sizeBytes: 8_400_000,
  minTier: 'r99',
  unlocked: false,
}

describe('My Library', () => {
  it('shows books in both languages, free planners and locked items with their tier', async () => {
    window.sessionStorage.setItem('ws12.demo', 'on')
    render(<App initialPath="/app/library" />)
    const books = (await screen.findByRole('heading', { name: 'My books' })).closest('section')!
    expect(within(books).getByText('English (8,4 MB)')).toBeInTheDocument()
    expect(within(books).getByText('Afrikaans (8,7 MB)')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Free planners' })).toBeInTheDocument()
    const locked = screen.getByRole('heading', { name: 'More with an upgrade' }).closest('section')!
    expect(within(locked).getByText('Included in the R199 package')).toBeInTheDocument()
    await userEvent.setup().click(within(locked).getByRole('button', { name: /Upgrade/ }))
    expect(screen.getByText('Upgrading in the app opens soon.')).toBeInTheDocument()
  })

  it('downloads through a short-lived link', async () => {
    const user = userEvent.setup()
    const { repository } = renderWithBackend('/app/library')
    await user.click(
      await screen.findByRole('button', { name: 'Download Winning Strategies for Grade 12' }),
    )
    expect(repository.getDownloadLink).toHaveBeenCalledWith('demo-book-en')
    expect(startDownload).toHaveBeenCalledWith('https://files.example.com/signed')
  })

  it('shows the free account state with Download planner', async () => {
    const user = userEvent.setup()
    const repository = mockRepository({ getLibrary: async () => [planner, lockedBook] })
    renderWithBackend('/app/library', { repository })
    expect(
      await screen.findByRole('heading', { name: 'Your free planners are ready.' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'See the full book' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Download planner' }))
    expect(repository.getDownloadLink).toHaveBeenCalledWith('planner-1')
  })

  it('offers Retry when a download fails and asks for a fresh link', async () => {
    const user = userEvent.setup()
    const repository = mockRepository()
    repository.getDownloadLink.mockRejectedValueOnce(new AppError('network'))
    renderWithBackend('/app/library', { repository })
    await user.click(
      await screen.findByRole('button', { name: 'Download Winning Strategies for Grade 12' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "The download didn't finish. Try again, ideally on Wi-Fi.",
    )
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(repository.getDownloadLink).toHaveBeenCalledTimes(2)
    expect(startDownload).toHaveBeenCalledTimes(1)
  })

  it('shows the purchase reference and Contact support when the entitlement check fails', async () => {
    const user = userEvent.setup()
    const repository = mockRepository()
    repository.getDownloadLink.mockRejectedValueOnce(
      new AppError('not_allowed', { purchaseRef: 'PF-2026-0042' }),
    )
    renderWithBackend('/app/library', { repository })
    await user.click(
      await screen.findByRole('button', { name: 'Download Winning Strategies for Grade 12' }),
    )
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent("We couldn't confirm your purchase.")
    expect(alert).toHaveTextContent('Purchase reference: PF-2026-0042')
    expect(within(alert).getByRole('link', { name: 'Contact support' })).toBeInTheDocument()
  })

  it('switches downloads off in the demo', async () => {
    const user = userEvent.setup()
    window.sessionStorage.setItem('ws12.demo', 'on')
    render(<App initialPath="/app/library" />)
    await user.click(
      await screen.findByRole('button', { name: 'Download Winning Strategies for Grade 12' }),
    )
    expect(await screen.findByText(/switched off in the demo/)).toBeInTheDocument()
    expect(startDownload).not.toHaveBeenCalled()
  })

  it('shows an error with Retry when the library cannot load', async () => {
    const repository = mockRepository({
      getLibrary: async () => {
        throw new AppError('network')
      },
    })
    renderWithBackend('/app/library', { repository })
    expect(await screen.findByText("We couldn't load your library.")).toBeInTheDocument()
  })
})
