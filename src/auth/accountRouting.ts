import type { AccountState } from '../data/learner'

export const startPath = '/start'
export const agePath = '/start/age'
export const consentPath = '/start/consent'
export const onboardingPath = '/start/onboarding'
export const familyPath = '/app/family'
export const dashboardWelcomePath = '/app/dashboard?welcome=1'

// A learner's own data may be saved once they are 18 or older, or once a parent has said yes.
export function canSaveLearnerData(state: AccountState): boolean {
  return state.isAdult === true || state.consentStatus === 'given'
}

export function isParent(state: AccountState): boolean {
  return state.roles.includes('parent')
}

// Where a signed-in person goes next (Product Bible 3.0): age question, consent for a minor,
// onboarding, then the dashboard. Parents land on Family, where they invite their child.
export function nextAccountPath(state: AccountState, returnTo: string | null = null): string {
  if (state.isAdult === null) return agePath
  if (!canSaveLearnerData(state)) return consentPath
  if (state.isAdult && returnTo) return returnTo
  if (isParent(state) && !state.onboarded) return familyPath
  if (!state.onboarded) return onboardingPath
  return '/app/dashboard'
}

// Ready for the app: the age question is answered, a minor has consent, and the person is
// onboarded, or is a parent, who starts in Family.
export function isAccountReady(state: AccountState): boolean {
  return !nextAccountPath(state).startsWith(`${startPath}/`)
}
