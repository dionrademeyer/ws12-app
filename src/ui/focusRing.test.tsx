import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { App } from '../app/App'

describe('focus ring scopes', () => {
  it('marks the welcome screen as a dark surface', () => {
    render(<App initialPath="/" />)
    const tryDemo = screen.getByRole('button', { name: 'Try the demo' })
    expect(tryDemo.closest('.on-dark')).toBeInTheDocument()
  })

  it('marks the header as dark and the account menu as a light panel inside it', async () => {
    window.sessionStorage.setItem('ws12.demo', 'on')
    const user = userEvent.setup()
    render(<App initialPath="/app/goals" />)

    const back = await screen.findByRole('button', { name: 'Back' })
    expect(back.closest('header')).toHaveClass('on-dark')

    await user.click(screen.getByRole('button', { name: 'Account menu' }))
    const menu = screen.getByRole('menu')
    expect(menu).toHaveClass('on-light')
    expect(menu.closest('.on-dark')).toBeInTheDocument()
  })
})
