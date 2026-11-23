import { isDraft, type OnboardingDraft } from '../domain/onboarding'

// Small values kept on this device only. Storage can be blocked (private browsing, full disk),
// so every read and write is wrapped and failures fall back to "nothing stored".

function read(storage: () => Storage, key: string): string | null {
  try {
    return storage().getItem(key)
  } catch {
    return null
  }
}

function write(storage: () => Storage, key: string, value: string | null) {
  try {
    if (value === null) storage().removeItem(key)
    else storage().setItem(key, value)
  } catch {
    // Not stored; the value only lives for this visit.
  }
}

const local = () => window.localStorage
const session = () => window.sessionStorage

const draftKey = (accountId: string) => `ws12.onboarding.${accountId}`

export function readOnboardingDraft(accountId: string): OnboardingDraft | null {
  const raw = read(local, draftKey(accountId))
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return isDraft(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function writeOnboardingDraft(accountId: string, draft: OnboardingDraft) {
  write(local, draftKey(accountId), JSON.stringify(draft))
}

export function clearOnboardingDraft(accountId: string) {
  write(local, draftKey(accountId), null)
}

export interface PendingAge {
  isAdult: boolean
  isParent: boolean
}

const pendingAgeKey = 'ws12.pendingAge'

export function readPendingAge(): PendingAge | null {
  const raw = read(local, pendingAgeKey)
  if (raw === 'adult') return { isAdult: true, isParent: false }
  if (raw === 'parent') return { isAdult: true, isParent: true }
  if (raw === 'minor') return { isAdult: false, isParent: false }
  return null
}

export function writePendingAge(age: PendingAge | null) {
  const value = age ? (age.isParent ? 'parent' : age.isAdult ? 'adult' : 'minor') : null
  write(local, pendingAgeKey, value)
}

const returnToKey = 'ws12.returnTo'

// Only the parent consent page is a valid place to come back to after signing in.
export function isSafeReturnPath(path: string | null): path is string {
  return !!path && /^\/consent\/[\w-]{1,64}$/.test(path)
}

export function readReturnTo(): string | null {
  const path = read(local, returnToKey)
  return isSafeReturnPath(path) ? path : null
}

export function writeReturnTo(path: string | null) {
  write(local, returnToKey, isSafeReturnPath(path) ? path : null)
}

const inviteKey = 'ws12.pendingInvite'

export function readPendingInvite(): string | null {
  const code = read(local, inviteKey)
  return code && /^[A-Z0-9]{4,16}$/.test(code) ? code : null
}

export function writePendingInvite(code: string | null) {
  write(local, inviteKey, code ? code.trim().toUpperCase() : null)
}

const consentRequestKey = 'ws12.consentRequest'

// The open consent request, so the learner can share its link again after a reload.
export function readConsentRequest(): { consentId: string; sent: boolean } | null {
  const raw = read(session, consentRequestKey)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { consentId?: unknown; sent?: unknown }
    return typeof parsed.consentId === 'string' && /^[\w-]{1,64}$/.test(parsed.consentId)
      ? { consentId: parsed.consentId, sent: parsed.sent === true }
      : null
  } catch {
    return null
  }
}

export function writeConsentRequest(request: { consentId: string; sent: boolean } | null) {
  write(session, consentRequestKey, request ? JSON.stringify(request) : null)
}

const consentContactKey = 'ws12.consentContact'

// Kept for this tab only, so "Resend" works without asking again.
export function readConsentContact(): string | null {
  return read(session, consentContactKey)
}

export function writeConsentContact(email: string | null) {
  write(session, consentContactKey, email)
}
