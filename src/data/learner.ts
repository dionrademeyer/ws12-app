import type { Language } from '../domain/language'
import type { OnboardingAnswers } from '../domain/onboarding'

export interface SubjectOption {
  id: string
  code: string
  name: Record<Language, string>
}

export interface SubjectSummary extends SubjectOption {
  targetMark: number | null
}

export interface SchoolOption {
  id: string
  name: string
  province: string
}

export interface LearnerExamDates {
  trial: string | null
  final: string | null
}

export interface LearnerProfile {
  id: string
  firstName: string
  lastName?: string
  grade: number
  province: string | null
  school: SchoolOption | null
  schoolNameOther: string | null
  subjects: SubjectSummary[]
  examDates: LearnerExamDates
  isDemo: boolean
}

export interface ProfileUpdate {
  firstName: string
  grade: number
  province: string | null
  schoolId: string | null
  schoolNameOther: string | null
  subjects: { code: string; targetMark: number | null }[]
  examDates: LearnerExamDates
}

export type ConsentStatus = 'not_needed' | 'none' | 'pending' | 'given' | 'withdrawn'

export interface AccountState {
  isAdult: boolean | null
  consentStatus: ConsentStatus
  roles: string[]
  onboardingStep: number
  onboarded: boolean
  language: Language
}

export interface ConsentRequest {
  learnerFirstName: string | null
  requestedAt: string
  expiresAt: string
  status: string
}

export type LibraryKind = 'book' | 'bonus' | 'planner'
export type Tier = 'free' | 'r99' | 'r199' | 'r349'

export interface LibraryItem {
  fileId: string
  kind: LibraryKind
  language: Language
  title: Record<Language, string>
  sizeBytes: number
  minTier: Tier
  unlocked: boolean
}

export interface DownloadLink {
  url: string
  expiresIn: number
}

export type InviteKind = 'parent_to_learner' | 'learner_to_parent'

export interface Invite {
  code: string
  expiresAt: string
}

// A removed link is listed only for the parent whose consent created it, while that consent is
// still given, so the parent can still withdraw it.
export type FamilyLinkStatus = 'pending' | 'active' | 'removed'

export interface FamilyLink {
  linkId: string
  otherUserId: string
  otherFirstName: string | null
  relation: 'parent' | 'child'
  status: FamilyLinkStatus
  waitingOnMe: boolean
  // Parents only: the request to answer on a pending link, or the given consent behind an
  // active or removed link, which the parent can withdraw.
  consentId: string | null
}

export interface ConsentRequestSent {
  consentId: string
  // False while sending real messages to parents is switched off.
  sent: boolean
}

export interface AccountRepository {
  getAccountState(): Promise<AccountState>
  declareAge(isAdult: boolean): Promise<void>
  claimParentRole(): Promise<void>
  claimEntitlements(): Promise<number>
  setLanguage(language: Language): Promise<void>
}

export interface ProfileRepository {
  getProfile(): Promise<LearnerProfile>
  updateProfile(update: ProfileUpdate): Promise<LearnerProfile>
  listSubjects(): Promise<SubjectOption[]>
  searchSchools(query: string, province: string | null): Promise<SchoolOption[]>
  getExamCalendar(year: number): Promise<LearnerExamDates>
  saveOnboarding(answers: OnboardingAnswers): Promise<void>
}

export interface ConsentRepository {
  requestConsent(parentEmail: string): Promise<ConsentRequestSent>
  getConsentRequest(consentId: string): Promise<ConsentRequest>
  giveConsent(consentId: string): Promise<void>
  declineConsent(consentId: string): Promise<void>
  withdrawConsent(consentId: string): Promise<void>
}

export interface LibraryRepository {
  getLibrary(): Promise<LibraryItem[]>
  getDownloadLink(fileId: string): Promise<DownloadLink>
}

export interface FamilyRepository {
  getFamily(): Promise<FamilyLink[]>
  createInvite(kind: InviteKind): Promise<Invite>
  redeemInvite(code: string): Promise<string>
  acceptLink(linkId: string): Promise<void>
  removeLink(linkId: string): Promise<void>
}

export interface LearnerRepository
  extends
    AccountRepository,
    ProfileRepository,
    ConsentRepository,
    LibraryRepository,
    FamilyRepository {
  isDemo: boolean
}
