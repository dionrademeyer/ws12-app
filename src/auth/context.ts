import { createContext } from 'react'
import type { AuthService, SessionUser } from '../data/auth'
import type { LearnerRepository } from '../data/learner'

export type SessionMode = 'loading' | 'signed-out' | 'demo' | 'signed-in'

export interface SessionValue {
  mode: SessionMode
  user: SessionUser | null
  repository: LearnerRepository | null
  // Null when no Supabase project is configured; sign-in screens then explain it is not set up.
  auth: AuthService | null
  authConfigured: boolean
  enterDemo: () => void
  leaveDemo: () => void
  signOut: () => Promise<void>
  claimEntitlementsOnce: () => Promise<void>
}

export const SessionContext = createContext<SessionValue | null>(null)
