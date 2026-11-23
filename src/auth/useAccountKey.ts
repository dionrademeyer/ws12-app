import { useSession } from './useSession'

// The key under which this device keeps the person's onboarding draft.
export function useAccountKey(): string | null {
  const { mode, user } = useSession()
  if (mode === 'demo') return 'demo'
  return user?.id ?? null
}
