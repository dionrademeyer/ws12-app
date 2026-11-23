import type { LearnerProfile } from './learner'
import { useRepositoryQuery } from './useRepositoryQuery'

export type ProfileState =
  { status: 'loading' } | { status: 'ready'; profile: LearnerProfile } | { status: 'error' }

export function useLearnerProfile(): ProfileState & { retry: () => void } {
  const { state, retry } = useRepositoryQuery((repository) => repository.getProfile())
  if (state.status === 'ready') return { status: 'ready', profile: state.data, retry }
  return { status: state.status, retry }
}
