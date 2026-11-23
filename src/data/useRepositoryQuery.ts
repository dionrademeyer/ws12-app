import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useSession } from '../auth/useSession'
import { errorCodeOf, type ErrorCode } from './errors'
import type { LearnerRepository } from './learner'

export type QueryState<T> =
  { status: 'loading' } | { status: 'ready'; data: T } | { status: 'error'; code: ErrorCode }

export interface Query<T> {
  state: QueryState<T>
  retry: () => void
  setData: (data: T) => void
}

// Loads data through the session's repository with loading, error and retry states.
export function useRepositoryQuery<T>(
  load: (repository: LearnerRepository) => Promise<T>,
): Query<T> {
  const { repository } = useSession()
  const [state, setState] = useState<QueryState<T>>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const loader = useRef(load)
  useLayoutEffect(() => {
    loader.current = load
  })

  useEffect(() => {
    if (!repository) return
    let active = true
    loader.current(repository).then(
      (data) => active && setState({ status: 'ready', data }),
      (error: unknown) => active && setState({ status: 'error', code: errorCodeOf(error) }),
    )
    return () => {
      active = false
    }
  }, [repository, attempt])

  const retry = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((value) => value + 1)
  }, [])

  const setData = useCallback((data: T) => setState({ status: 'ready', data }), [])

  return {
    state: repository ? state : { status: 'error', code: 'not_signed_in' },
    retry,
    setData,
  }
}
