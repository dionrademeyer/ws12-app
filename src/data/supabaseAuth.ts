import type { AuthChangeEvent, Session, SupabaseClient, User } from '@supabase/supabase-js'
import type { AuthEvent, AuthService, SessionUser } from './auth'
import { AppError } from './errors'
import { fromAuthError } from './supabaseErrors'

export function toSessionUser(user: User | null | undefined): SessionUser | null {
  if (!user) return null
  return { id: user.id, email: user.email ?? null, emailVerified: !!user.email_confirmed_at }
}

function toAuthEvent(event: AuthChangeEvent): AuthEvent {
  if (event === 'SIGNED_OUT') return 'signed-out'
  if (event === 'PASSWORD_RECOVERY') return 'password-recovery'
  if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') return 'signed-in'
  return 'updated'
}

function raise(error: unknown) {
  if (error) throw fromAuthError(error as Record<string, unknown>)
}

export function createSupabaseAuth(client: SupabaseClient): AuthService {
  return {
    async getSessionUser() {
      const { data, error } = await client.auth.getSession()
      raise(error)
      return toSessionUser(data.session?.user)
    },

    onChange(listener) {
      const { data } = client.auth.onAuthStateChange(
        (event: AuthChangeEvent, session: Session | null) => {
          listener(toSessionUser(session?.user), toAuthEvent(event))
        },
      )
      return () => data.subscription.unsubscribe()
    },

    async signInWithProvider(provider, redirectTo) {
      const { error } = await client.auth.signInWithOAuth({ provider, options: { redirectTo } })
      raise(error)
    },

    async signInWithEmail(email, password) {
      const { error } = await client.auth.signInWithPassword({ email, password })
      raise(error)
    },

    async signUpWithEmail(email, password, redirectTo, language) {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectTo, data: { language } },
      })
      raise(error)
      // With email confirmation on, an existing address comes back as a user with no identities.
      if (data.user && data.user.identities?.length === 0) throw new AppError('email_taken')
      return { needsVerification: !data.session }
    },

    async resendVerification(email, redirectTo) {
      const { error } = await client.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: redirectTo },
      })
      raise(error)
    },

    async sendPasswordReset(email, redirectTo) {
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo })
      raise(error)
    },

    async updatePassword(password) {
      const { error } = await client.auth.updateUser({ password })
      raise(error)
    },

    async signOut() {
      const { error } = await client.auth.signOut()
      raise(error)
    },
  }
}
