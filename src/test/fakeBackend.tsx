import { render } from '@testing-library/react'
import { vi, type Mocked } from 'vitest'
import { App } from '../app/App'
import type { AuthEvent, AuthService, Backend, SessionUser } from '../data/auth'
import type { AccountState, LearnerRepository } from '../data/learner'
import { createDemoRepository } from '../demo/demoRepository'

export const testUser: SessionUser = {
  id: 'user-1',
  email: 'learner@example.com',
  emailVerified: true,
}

export const onboardedAdult: AccountState = {
  isAdult: true,
  consentStatus: 'not_needed',
  roles: ['learner'],
  onboardingStep: 5,
  onboarded: true,
  language: 'en',
}

export const waitingMinor: AccountState = {
  isAdult: false,
  consentStatus: 'none',
  roles: ['learner'],
  onboardingStep: 0,
  onboarded: false,
  language: 'en',
}

// A repository for tests: the demo data, marked as a real account, with every method a spy.
export function mockRepository(
  overrides: Partial<LearnerRepository> = {},
): Mocked<LearnerRepository> {
  const demo = createDemoRepository()
  const base: LearnerRepository = {
    ...demo,
    isDemo: false,
    getAccountState: async () => ({ ...onboardedAdult }),
    getProfile: async () => ({ ...(await demo.getProfile()), isDemo: false }),
    redeemInvite: async () => 'link-1',
    getDownloadLink: async () => ({ url: 'https://files.example.com/signed', expiresIn: 300 }),
    ...overrides,
  }
  const mocked = { isDemo: base.isDemo } as Mocked<LearnerRepository>
  for (const [key, value] of Object.entries(base)) {
    if (typeof value === 'function') {
      ;(mocked as unknown as Record<string, unknown>)[key] = vi.fn(value)
    }
  }
  return mocked
}

export function mockAuth(initialUser: SessionUser | null = null) {
  let user = initialUser
  const listeners = new Set<(user: SessionUser | null, event: AuthEvent) => void>()
  const emit = (event: AuthEvent) => listeners.forEach((listener) => listener(user, event))

  const auth = {
    getSessionUser: vi.fn(async () => user),
    onChange: vi.fn((listener: (user: SessionUser | null, event: AuthEvent) => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }),
    signInWithProvider: vi.fn(async () => undefined),
    signInWithEmail: vi.fn(async () => {
      user = testUser
      emit('signed-in')
    }),
    signUpWithEmail: vi.fn(async () => ({ needsVerification: true })),
    resendVerification: vi.fn(async () => undefined),
    sendPasswordReset: vi.fn(async () => undefined),
    updatePassword: vi.fn(async () => undefined),
    signOut: vi.fn(async () => {
      user = null
      emit('signed-out')
    }),
  } satisfies AuthService

  return auth
}

export function fakeBackend(auth: AuthService, repository: LearnerRepository): Promise<Backend> {
  return Promise.resolve({ auth, createRepository: () => repository })
}

interface RenderOptions {
  user?: SessionUser | null
  repository?: LearnerRepository
  auth?: ReturnType<typeof mockAuth>
}

export function renderWithBackend(path: string, options: RenderOptions = {}) {
  const auth = options.auth ?? mockAuth(options.user === undefined ? testUser : options.user)
  const repository = options.repository ?? mockRepository()
  const view = render(<App initialPath={path} backend={fakeBackend(auth, repository)} />)
  return { ...view, auth, repository }
}
