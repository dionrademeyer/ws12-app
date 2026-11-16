import { createContext } from 'react'
import type { LearnerRepository } from '../data/learner'

export type SessionMode = 'signed-out' | 'demo'

export interface SessionValue {
  mode: SessionMode
  repository: LearnerRepository | null
  enterDemo: () => void
  leaveDemo: () => void
}

export const SessionContext = createContext<SessionValue | null>(null)
