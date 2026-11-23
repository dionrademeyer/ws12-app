import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { App } from '../../app/App'
import { AppError } from '../../data/errors'
import type { FamilyLink } from '../../data/learner'
import { mockRepository, onboardedAdult, renderWithBackend } from '../../test/fakeBackend'

const parentAccount = { ...onboardedAdult, roles: ['learner', 'parent'] }

const pendingChild: FamilyLink = {
  linkId: 'link-child',
  otherUserId: 'child-1',
  otherFirstName: 'Thabo',
  relation: 'child',
  status: 'pending',
  waitingOnMe: true,
  consentId: null,
}

describe('Family for a learner', () => {
  it('shows the empty state and what parents can see', async () => {
    const repository = mockRepository({ getFamily: async () => [] })
    renderWithBackend('/app/family', { repository })
    expect(
      await screen.findByRole('heading', {
        name: 'No parent linked yet. A parent gets a short weekly summary so they can support you.',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'What a linked parent can see' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Parents never see your AI Tutor chats/)).toBeInTheDocument()
  })

  it('makes a link to share on WhatsApp', async () => {
    const user = userEvent.setup()
    const repository = mockRepository({ getFamily: async () => [] })
    renderWithBackend('/app/family', { repository })
    await user.click(await screen.findByRole('button', { name: 'Add a parent' }))
    await user.click(screen.getByRole('button', { name: 'Make my link' }))

    expect(repository.createInvite).toHaveBeenCalledWith('learner_to_parent')
    expect(await screen.findByText('DEMO2345')).toBeInTheDocument()
    const whatsapp = screen.getByRole('link', { name: 'Share on WhatsApp' })
    const href = whatsapp.getAttribute('href') ?? ''
    expect(href.startsWith('https://wa.me/?text=')).toBe(true)
    expect(decodeURIComponent(href)).toContain('/register?invite=DEMO2345&parent=1')
  })

  it("enters a parent's code, with wrong code and rate limit messages", async () => {
    const user = userEvent.setup()
    const repository = mockRepository({ getFamily: async () => [] })
    repository.redeemInvite
      .mockRejectedValueOnce(new AppError('code_expired'))
      .mockRejectedValueOnce(new AppError('rate_limited'))
    renderWithBackend('/app/family', { repository })
    await user.click(await screen.findByRole('button', { name: 'Add a parent' }))
    await user.type(screen.getByLabelText('Invite code'), 'wrong123')
    await user.click(screen.getByRole('button', { name: 'Use code' }))
    expect(
      await screen.findByText("That code didn't work. Check it or ask for a new one."),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Use code' }))
    expect(await screen.findByText('Please wait a while and try again.')).toBeInTheDocument()
  })

  it('shows a linked parent from the demo and removes the link after a confirm', async () => {
    const user = userEvent.setup()
    window.sessionStorage.setItem('ws12.demo', 'on')
    render(<App initialPath="/app/family" />)
    expect(await screen.findByText('Nomsa')).toBeInTheDocument()
    expect(screen.getByText('Linked')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Remove: Nomsa' }))
    const dialog = screen.getByRole('alertdialog', { name: 'Remove the link with Nomsa?' })
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }))
    expect(await screen.findByRole('heading', { name: /No parent linked yet/ })).toBeInTheDocument()
  })

  it('shows pending links waiting for the other side, with Resend and Cancel', async () => {
    const repository = mockRepository({
      getFamily: async () => [
        { ...pendingChild, relation: 'parent', otherFirstName: 'Nomsa', waitingOnMe: false },
      ],
    })
    renderWithBackend('/app/family', { repository })
    expect(await screen.findByText('Waiting for Nomsa to accept')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resend' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel: Nomsa' })).toBeInTheDocument()
  })
})

describe('Family for a parent', () => {
  it('invites a child with a code and a WhatsApp share link', async () => {
    const user = userEvent.setup()
    const repository = mockRepository({
      getFamily: async () => [],
      getAccountState: async () => parentAccount,
    })
    renderWithBackend('/app/family', { repository })
    expect(
      await screen.findByRole('heading', { name: 'Invite your child to get started.' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Invite my child' }))
    expect(repository.createInvite).toHaveBeenCalledWith('parent_to_learner')
    expect(await screen.findByText('DEMO2345')).toBeInTheDocument()
    const href = screen.getByRole('link', { name: 'Share on WhatsApp' }).getAttribute('href') ?? ''
    expect(decodeURIComponent(href)).toContain('/register?invite=DEMO2345')
    expect(decodeURIComponent(href)).not.toContain('parent=1')
  })

  it('accepts a child who is waiting', async () => {
    const user = userEvent.setup()
    const repository = mockRepository({
      getFamily: async () => [pendingChild],
      getAccountState: async () => parentAccount,
    })
    renderWithBackend('/app/family', { repository })
    expect(await screen.findByText('Thabo wants to link with you')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Accept' }))
    expect(repository.acceptLink).toHaveBeenCalledWith('link-child')
  })

  it('sends a parent to the consent page when the child still needs consent', async () => {
    const repository = mockRepository({
      getFamily: async () => [{ ...pendingChild, otherFirstName: null, consentId: 'consent-9' }],
      getAccountState: async () => parentAccount,
    })
    renderWithBackend('/app/family', { repository })
    expect(await screen.findByText('Your child wants to link with you')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Review and give consent' })).toHaveAttribute(
      'href',
      '/consent/consent-9',
    )
    expect(screen.queryByRole('button', { name: 'Accept' })).toBeNull()
  })

  const consentChild: FamilyLink = {
    ...pendingChild,
    linkId: 'link-consent',
    status: 'active',
    waitingOnMe: false,
    consentId: 'consent-given',
  }

  it('withdraws consent on an active consent link after a confirm that explains the effect', async () => {
    const user = userEvent.setup()
    let links: FamilyLink[] = [consentChild]
    const repository = mockRepository({
      getFamily: async () => links,
      getAccountState: async () => parentAccount,
      withdrawConsent: async () => {
        links = []
      },
    })
    renderWithBackend('/app/family', { repository })
    await user.click(await screen.findByRole('button', { name: 'Withdraw consent: Thabo' }))
    const dialog = screen.getByRole('alertdialog', { name: 'Withdraw your consent for Thabo?' })
    expect(dialog).toHaveTextContent(
      "The link with Thabo is removed and Thabo's data stops being processed",
    )
    await user.click(within(dialog).getByRole('button', { name: 'Withdraw consent' }))

    expect(repository.withdrawConsent).toHaveBeenCalledWith('consent-given')
    expect(repository.removeLink).not.toHaveBeenCalled()
    expect(await screen.findByText('Your consent is withdrawn.')).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(
      await screen.findByRole('heading', { name: 'Invite your child to get started.' }),
    ).toBeInTheDocument()
  })

  it('keeps the dialog choice safe: Cancel withdraws nothing, and a failure shows an error', async () => {
    const user = userEvent.setup()
    const repository = mockRepository({
      getFamily: async () => [consentChild],
      getAccountState: async () => parentAccount,
    })
    repository.withdrawConsent.mockRejectedValueOnce(new AppError('network'))
    renderWithBackend('/app/family', { repository })
    await user.click(await screen.findByRole('button', { name: 'Withdraw consent: Thabo' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(repository.withdrawConsent).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Withdraw consent: Thabo' }))
    const dialog = screen.getByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Withdraw consent' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText('Your consent is withdrawn.')).toBeNull()
  })

  it('says that Remove on a consent link withdraws the consent too', async () => {
    const user = userEvent.setup()
    const repository = mockRepository({
      getFamily: async () => [consentChild],
      getAccountState: async () => parentAccount,
    })
    renderWithBackend('/app/family', { repository })
    await user.click(await screen.findByRole('button', { name: 'Remove: Thabo' }))
    const dialog = screen.getByRole('alertdialog', { name: 'Remove the link with Thabo?' })
    expect(dialog).toHaveTextContent('This also withdraws your consent.')
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }))
    expect(repository.removeLink).toHaveBeenCalledWith('link-consent')
  })

  it('keeps the plain Remove text on a link without consent', async () => {
    const user = userEvent.setup()
    const repository = mockRepository({
      getFamily: async () => [{ ...pendingChild, status: 'active', waitingOnMe: false }],
      getAccountState: async () => parentAccount,
    })
    renderWithBackend('/app/family', { repository })
    await user.click(await screen.findByRole('button', { name: 'Remove: Thabo' }))
    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toHaveTextContent('You can link again later with a new code.')
    expect(dialog).not.toHaveTextContent('withdraws your consent')
    expect(screen.queryByRole('button', { name: 'Withdraw consent: Thabo' })).toBeNull()
  })

  it('shows a link the child removed while consent is active, with Withdraw consent only', async () => {
    const user = userEvent.setup()
    const repository = mockRepository({
      getFamily: async () => [{ ...consentChild, status: 'removed' }],
      getAccountState: async () => parentAccount,
    })
    renderWithBackend('/app/family', { repository })
    expect(
      await screen.findByText('Link removed by your child. Your consent is still active.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Link removed')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove: Thabo' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Withdraw consent: Thabo' }))
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Withdraw consent' }),
    )
    expect(repository.withdrawConsent).toHaveBeenCalledWith('consent-given')
  })

  it('shows an error with Retry when Family cannot load', async () => {
    const repository = mockRepository({
      getFamily: async () => {
        throw new AppError('network')
      },
    })
    renderWithBackend('/app/family', { repository })
    expect(await screen.findByText("We couldn't load your family links.")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})
