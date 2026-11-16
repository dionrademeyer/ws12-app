import { useCallback, useEffect, useState } from 'react'
import { useSession } from '../auth/useSession'
import type { LearnerProfile } from './learner'

export type ProfileState =
  { status: 'loading' } | { status: 'ready'; profile: LearnerProfile } | { status: 'error' }

export function useLearnerProfile(): ProfileState & { retry: () => void } {
  const { repository } = useSession()
  const [state, setState] = useState<ProfileState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!repository) return
    let active = true
    repository.getProfile().then(
      (profile) => active && setState({ status: 'ready', profile }),
      () => active && setState({ status: 'error' }),
    )
    return () => {
      active = false
    }
  }, [repository, attempt])

  const retry = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((value) => value + 1)
  }, [])

  return repository ? { ...state, retry } : { status: 'error', retry }
}
