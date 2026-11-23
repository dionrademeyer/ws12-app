import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { App } from '../../app/App'
import { AppError } from '../../data/errors'
import type { LearnerProfile } from '../../data/learner'
import { mockRepository, renderWithBackend } from '../../test/fakeBackend'

const sparseProfile: LearnerProfile = {
  id: 'user-1',
  firstName: 'Lerato',
  grade: 12,
  province: null,
  school: null,
  schoolNameOther: null,
  subjects: [],
  examDates: { trial: null, final: null },
  isDemo: false,
}

describe('profile', () => {
  it('shows a skeleton while loading', async () => {
    const repository = mockRepository({ getProfile: () => new Promise(() => undefined) })
    renderWithBackend('/app/profile', { repository })
    expect(await screen.findByRole('status')).toHaveTextContent('Loading')
  })

  it('shows an error with Retry', async () => {
    const user = userEvent.setup()
    let fail = true
    const repository = mockRepository({
      getProfile: async () => {
        if (fail) throw new AppError('network')
        return { ...sparseProfile, firstName: 'Thabo' }
      },
    })
    renderWithBackend('/app/profile', { repository })
    expect(await screen.findByText("We couldn't load your profile.")).toBeInTheDocument()
    fail = false
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { name: 'Profile' })).toBeInTheDocument()
  })

  it('shows Add prompts for missing details and leads with Add your exam date', async () => {
    const repository = mockRepository({ getProfile: async () => sparseProfile })
    renderWithBackend('/app/profile', { repository })
    expect(await screen.findByRole('button', { name: 'Add your school' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add your subjects' })).toBeInTheDocument()
    expect(screen.getByText('No exam dates yet.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add your exam date' })).toBeInTheDocument()
  })

  it("shows the demo learner's subjects, targets and exam dates", async () => {
    window.sessionStorage.setItem('ws12.demo', 'on')
    render(<App initialPath="/app/profile" />)
    expect(await screen.findByText('Thabo Mokoena')).toBeInTheDocument()
    expect(screen.getByText('Target 70 percent')).toBeInTheDocument()
    expect(screen.getByText('23 August 2027')).toBeInTheDocument()
    expect(screen.getByText('Demo High School')).toBeInTheDocument()
  })

  it('edits and saves, then shows Saved', async () => {
    const user = userEvent.setup()
    const { repository } = renderWithBackend('/app/profile')
    await user.click(await screen.findByRole('button', { name: 'Edit profile' }))
    const name = await screen.findByLabelText('First name')
    await user.clear(name)
    await user.type(name, 'Thabiso')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Saved')).toBeInTheDocument()
    expect(screen.getByText('Thabiso Mokoena')).toBeInTheDocument()
    expect(repository.updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: 'Thabiso',
        grade: 12,
        examDates: { trial: '2027-08-23', final: '2027-10-25' },
        subjects: expect.arrayContaining([{ subjectId: 'demo-subject-math', targetMark: 70 }]),
      }),
    )
  })

  it('keeps the edits on screen with Try again when saving fails', async () => {
    const user = userEvent.setup()
    const repository = mockRepository()
    repository.updateProfile.mockRejectedValueOnce(new AppError('network'))
    renderWithBackend('/app/profile', { repository })
    await user.click(await screen.findByRole('button', { name: 'Edit profile' }))
    const name = await screen.findByLabelText('First name')
    await user.clear(name)
    await user.type(name, 'Thabiso')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't save your changes.")
    expect(screen.getByLabelText('First name')).toHaveValue('Thabiso')
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Saved')).toBeInTheDocument()
  })

  it('opens the exam dates when adding a missing exam date', async () => {
    const user = userEvent.setup()
    const repository = mockRepository({ getProfile: async () => sparseProfile })
    renderWithBackend('/app/profile', { repository })
    await user.click(await screen.findByRole('button', { name: 'Add your exam date' }))
    const exams = await screen.findByRole('region', { name: 'Exam dates' })
    expect(within(exams).getByLabelText('Trial exams start')).toHaveFocus()
  })
})
