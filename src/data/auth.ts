import type { Language } from '../domain/language'
import type { LearnerRepository } from './learner'

export interface SessionUser {
  id: string
  email: string | null
  emailVerified: boolean
}

export type AuthEvent = 'signed-in' | 'signed-out' | 'password-recovery' | 'updated'

export interface SignUpResult {
  needsVerification: boolean
}

// Sign-in providers live in one list so Apple can be added later without changing screens.
export const oauthProviders = ['google'] as const
export type OAuthProvider = (typeof oauthProviders)[number]

export interface AuthService {
  getSessionUser(): Promise<SessionUser | null>
  onChange(listener: (user: SessionUser | null, event: AuthEvent) => void): () => void
  signInWithProvider(provider: OAuthProvider, redirectTo: string): Promise<void>
  signInWithEmail(email: string, password: string): Promise<void>
  signUpWithEmail(
    email: string,
    password: string,
    redirectTo: string,
    language: Language,
  ): Promise<SignUpResult>
  resendVerification(email: string, redirectTo: string): Promise<void>
  sendPasswordReset(email: string, redirectTo: string): Promise<void>
  updatePassword(password: string): Promise<void>
  signOut(): Promise<void>
}

export interface Backend {
  auth: AuthService
  createRepository(user: SessionUser): LearnerRepository
}
