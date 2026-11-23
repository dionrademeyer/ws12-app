export const signInPath = '/signin'
export const registerPath = '/register'
export const verifyEmailPath = '/verify-email'
export const forgotPasswordPath = '/forgot-password'
export const resetPasswordPath = '/reset-password'
export const callbackPath = '/auth/callback'

export function absoluteUrl(path: string): string {
  return `${window.location.origin}${path}`
}

export const minPasswordLength = 8

export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())
}

// Supabase reports a failed redirect with error parameters in the query or the hash.
export function authErrorInUrl(search: string, hash: string): boolean {
  const query = new URLSearchParams(search)
  const fragment = new URLSearchParams(hash.replace(/^#/, ''))
  return ['error', 'error_code', 'error_description'].some(
    (name) => query.has(name) || fragment.has(name),
  )
}
