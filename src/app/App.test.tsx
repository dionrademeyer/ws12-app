import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderWithBackend } from '../test/fakeBackend'
import { App } from './App'

function startDemo() {
  window.sessionStorage.setItem('ws12.demo', 'on')
}

describe('welcome and demo mode', () => {
  it('opens the demo from the welcome screen with no Supabase settings', async () => {
    const user = userEvent.setup()
    render(<App initialPath="/" />)
    expect(screen.getByText('Your Grade 12 journey starts here.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Try the demo' }))

    expect(await screen.findByRole('heading', { name: 'Hi Thabo' })).toBeInTheDocument()
    const banner = screen.getByRole('complementary', { name: 'Demo' })
    expect(banner).toHaveTextContent('Thabo Mokoena, a sample learner')
    expect(within(banner).getByRole('link', { name: 'Create my own account' })).toBeInTheDocument()
  })

  it('sends a visitor who is not in demo mode back to the welcome screen', async () => {
    render(<App initialPath="/app/goals" />)
    expect(await screen.findByRole('button', { name: 'Try the demo' })).toBeInTheDocument()
  })

  it.each([
    '/app/dashboard',
    '/app/goals',
    '/app/planner',
    '/app/progress',
    '/app/tutor',
    '/app/profile',
    '/app/settings',
    '/app/notifications',
    '/app/library',
    '/app/family',
    '/start/onboarding',
    '/app/unknown',
  ])('shows the demo banner on %s', async (path) => {
    startDemo()
    render(<App initialPath={path} />)
    expect(await screen.findByRole('complementary', { name: 'Demo' })).toBeInTheDocument()
  })

  it("shows Thabo's demo subjects on the profile", async () => {
    startDemo()
    render(<App initialPath="/app/profile" />)
    expect(await screen.findByText('Thabo Mokoena')).toBeInTheDocument()
    expect(screen.getByText('Grade 12')).toBeInTheDocument()
    for (const subject of [
      'Mathematics',
      'Physical Sciences',
      'English Home Language',
      'Life Orientation',
    ]) {
      expect(screen.getByText(subject)).toBeInTheDocument()
    }
  })
})

describe('app shell', () => {
  it('has the five main tabs and no hamburger menu', async () => {
    startDemo()
    render(<App initialPath="/app/dashboard" />)
    await screen.findByRole('heading', { name: 'Hi Thabo' })

    const navs = screen.getAllByRole('navigation', { name: 'Main navigation' })
    const bottomNav = navs.find((nav) => nav.className.includes('bottom-0'))
    expect(bottomNav).toBeDefined()
    const labels = within(bottomNav!)
      .getAllByRole('link')
      .map((link) => link.textContent)
    expect(labels).toEqual(['Dashboard', 'Goals', 'Planner', 'Progress', 'AI Tutor'])

    const popupButtons = screen
      .getAllByRole('button')
      .filter((button) => button.hasAttribute('aria-haspopup'))
    expect(popupButtons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Account menu',
    ])
    expect(screen.queryByRole('button', { name: /hamburger|open menu|navigation/i })).toBeNull()
  })

  it('opens the avatar menu with the secondary links and closes it with Escape', async () => {
    const user = userEvent.setup()
    startDemo()
    render(<App initialPath="/app/dashboard" />)
    await screen.findByRole('heading', { name: 'Hi Thabo' })

    const avatar = screen.getByRole('button', { name: 'Account menu' })
    expect(avatar).toHaveTextContent('TM')
    await user.click(avatar)

    const menu = screen.getByRole('menu')
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Profile', 'My Library', 'Family', 'Settings', 'Help', 'Log out'])
    expect(within(menu).getByRole('menuitem', { name: 'Profile' })).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(avatar).toHaveFocus()
  })

  it('shows a back button on inner screens only', async () => {
    const user = userEvent.setup()
    startDemo()
    render(<App initialPath="/app/goals" />)
    await user.click(await screen.findByRole('button', { name: 'Back' }))
    expect(await screen.findByRole('heading', { name: 'Hi Thabo' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull()
  })

  it('logs out of the demo from the avatar menu after a confirm', async () => {
    const user = userEvent.setup()
    startDemo()
    render(<App initialPath="/app/dashboard" />)
    await user.click(await screen.findByRole('button', { name: 'Account menu' }))
    await user.click(screen.getByRole('menuitem', { name: 'Log out' }))

    const dialog = screen.getByRole('alertdialog', { name: 'Log out of WS12?' })
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(window.sessionStorage.getItem('ws12.demo')).toBe('on')

    await user.click(screen.getByRole('button', { name: 'Account menu' }))
    await user.click(screen.getByRole('menuitem', { name: 'Log out' }))
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Log out' }),
    )
    expect(await screen.findByRole('button', { name: 'Try the demo' })).toBeInTheDocument()
    expect(window.sessionStorage.getItem('ws12.demo')).toBeNull()
  })

  it('closes the log out confirm with Escape', async () => {
    const user = userEvent.setup()
    startDemo()
    render(<App initialPath="/app/dashboard" />)
    await user.click(await screen.findByRole('button', { name: 'Account menu' }))
    await user.click(screen.getByRole('menuitem', { name: 'Log out' }))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('signs a real account out through Supabase and returns to Welcome', async () => {
    const user = userEvent.setup()
    const { auth } = renderWithBackend('/app/dashboard')
    await user.click(await screen.findByRole('button', { name: 'Account menu' }))
    await user.click(screen.getByRole('menuitem', { name: 'Log out' }))
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Log out' }),
    )
    expect(await screen.findByRole('button', { name: 'Continue with Google' })).toBeInTheDocument()
    expect(auth.signOut).toHaveBeenCalled()
  })
})

describe('language', () => {
  it('switches the whole shell to Afrikaans from Settings and remembers it', async () => {
    const user = userEvent.setup()
    startDemo()
    render(<App initialPath="/app/settings" />)
    await user.click(await screen.findByRole('button', { name: 'Afrikaans' }))

    await waitFor(() => expect(document.documentElement.lang).toBe('af'))
    expect(screen.getByRole('heading', { name: 'Instellings' })).toBeInTheDocument()
    expect(screen.getAllByText('Paneelbord').length).toBeGreaterThan(0)
    expect(screen.getAllByText('WENNER STRATEGIEË VIR GRAAD 12').length).toBe(1)
    expect(screen.getByRole('complementary', { name: 'Demo' })).toHaveTextContent(
      "'n voorbeeldleerder",
    )
    expect(window.localStorage.getItem('ws12.language')).toBe('af')
  })
})
