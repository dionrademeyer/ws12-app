import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { createSupabaseAuth } from './supabaseAuth'

function fakeAuthClient(overrides: Record<string, unknown> = {}) {
  let listener: ((event: string, session: unknown) => void) | undefined
  const unsubscribe = vi.fn()
  const auth = {
    getSession: vi.fn(async () => ({
      data: {
        session: { user: { id: 'u1', email: 'a@example.com', email_confirmed_at: '2026-11-01' } },
      },
      error: null,
    })),
    onAuthStateChange: vi.fn((callback: (event: string, session: unknown) => void) => {
      listener = callback
      return { data: { subscription: { unsubscribe } } }
    }),
    signInWithOAuth: vi.fn(async () => ({ data: {}, error: null })),
    signInWithPassword: vi.fn(async () => ({ data: {}, error: null })),
    signUp: vi.fn(async () => ({
      data: { user: { id: 'u1', identities: [{}] }, session: null },
      error: null,
    })),
    resend: vi.fn(async () => ({ data: {}, error: null })),
    resetPasswordForEmail: vi.fn(async () => ({ data: {}, error: null })),
    updateUser: vi.fn(async () => ({ data: {}, error: null })),
    signOut: vi.fn(async () => ({ error: null })),
    ...overrides,
  }
  return {
    client: { auth } as unknown as SupabaseClient,
    auth,
    emit: (event: string, session: unknown) => listener?.(event, session),
    unsubscribe,
  }
}

describe('Supabase auth service', () => {
  it('reads the current session user', async () => {
    const { client } = fakeAuthClient()
    expect(await createSupabaseAuth(client).getSessionUser()).toEqual({
      id: 'u1',
      email: 'a@example.com',
      emailVerified: true,
    })
  })

  it('passes auth state changes on and unsubscribes', () => {
    const { client, emit, unsubscribe } = fakeAuthClient()
    const listener = vi.fn()
    const stop = createSupabaseAuth(client).onChange(listener)
    emit('SIGNED_IN', { user: { id: 'u2', email: null, email_confirmed_at: null } })
    emit('PASSWORD_RECOVERY', { user: { id: 'u2' } })
    emit('SIGNED_OUT', null)
    expect(listener.mock.calls).toEqual([
      [{ id: 'u2', email: null, emailVerified: false }, 'signed-in'],
      [{ id: 'u2', email: null, emailVerified: false }, 'password-recovery'],
      [null, 'signed-out'],
    ])
    stop()
    expect(unsubscribe).toHaveBeenCalled()
  })

  it('starts Google sign-in with the callback address', async () => {
    const { client, auth } = fakeAuthClient()
    await createSupabaseAuth(client).signInWithProvider('google', 'https://app/auth/callback')
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'https://app/auth/callback' },
    })
  })

  it('reports when the new account needs email verification', async () => {
    const { client, auth } = fakeAuthClient()
    const result = await createSupabaseAuth(client).signUpWithEmail(
      'a@example.com',
      'secret12',
      'https://app/cb',
    )
    expect(result).toEqual({ needsVerification: true })
    expect(auth.signUp).toHaveBeenCalledWith({
      email: 'a@example.com',
      password: 'secret12',
      options: { emailRedirectTo: 'https://app/cb' },
    })
  })

  it('treats a sign-up with no identities as an existing email', async () => {
    const { client } = fakeAuthClient({
      signUp: vi.fn(async () => ({
        data: { user: { id: 'u1', identities: [] }, session: null },
        error: null,
      })),
    })
    await expect(
      createSupabaseAuth(client).signUpWithEmail('a@example.com', 'secret12', 'x'),
    ).rejects.toMatchObject({ code: 'email_taken' })
  })

  it.each([
    ['invalid_credentials', 'invalid_credentials'],
    ['email_not_confirmed', 'email_not_verified'],
    ['over_email_send_rate_limit', 'rate_limited'],
    ['something_else', 'unknown'],
  ])('maps the auth error %s to %s', async (supabaseCode, appCode) => {
    const { client } = fakeAuthClient({
      signInWithPassword: vi.fn(async () => ({
        data: {},
        error: { code: supabaseCode, message: 'x' },
      })),
    })
    await expect(
      createSupabaseAuth(client).signInWithEmail('a@example.com', 'p'),
    ).rejects.toMatchObject({
      code: appCode,
    })
  })

  it('resends verification, sends a reset link, changes the password and signs out', async () => {
    const { client, auth } = fakeAuthClient()
    const service = createSupabaseAuth(client)
    await service.resendVerification('a@example.com', 'https://app/cb')
    await service.sendPasswordReset('a@example.com', 'https://app/reset-password')
    await service.updatePassword('newsecret')
    await service.signOut()
    expect(auth.resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'a@example.com',
      options: { emailRedirectTo: 'https://app/cb' },
    })
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('a@example.com', {
      redirectTo: 'https://app/reset-password',
    })
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'newsecret' })
    expect(auth.signOut).toHaveBeenCalled()
  })
})
