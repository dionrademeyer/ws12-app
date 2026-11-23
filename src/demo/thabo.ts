import type {
  AccountState,
  FamilyLink,
  LearnerProfile,
  LibraryItem,
  SchoolOption,
  SubjectOption,
} from '../data/learner'

// Sample data for demo mode (Product Bible 3.23). Shown only with the demo banner and never
// written to real learner tables. Every name here is a sample, not a real person or school.

export const demoSubjects: SubjectOption[] = [
  { id: 'demo-subject-acc', code: 'ACC', name: { en: 'Accounting', af: 'Rekeningkunde' } },
  {
    id: 'demo-subject-afhl',
    code: 'AFHL',
    name: { en: 'Afrikaans Home Language', af: 'Afrikaans Huistaal' },
  },
  { id: 'demo-subject-bus', code: 'BUS', name: { en: 'Business Studies', af: 'Besigheidstudies' } },
  {
    id: 'demo-subject-enfal',
    code: 'ENFAL',
    name: { en: 'English First Additional Language', af: 'Engels Eerste Addisionele Taal' },
  },
  {
    id: 'demo-subject-enhl',
    code: 'ENHL',
    name: { en: 'English Home Language', af: 'Engels Huistaal' },
  },
  { id: 'demo-subject-geo', code: 'GEO', name: { en: 'Geography', af: 'Geografie' } },
  { id: 'demo-subject-hist', code: 'HIST', name: { en: 'History', af: 'Geskiedenis' } },
  { id: 'demo-subject-lfsc', code: 'LFSC', name: { en: 'Life Sciences', af: 'Lewenswetenskappe' } },
  { id: 'demo-subject-lo', code: 'LO', name: { en: 'Life Orientation', af: 'Lewensoriëntering' } },
  {
    id: 'demo-subject-mlit',
    code: 'MLIT',
    name: { en: 'Mathematical Literacy', af: 'Wiskundige Geletterdheid' },
  },
  { id: 'demo-subject-math', code: 'MATH', name: { en: 'Mathematics', af: 'Wiskunde' } },
  {
    id: 'demo-subject-phsc',
    code: 'PHSC',
    name: { en: 'Physical Sciences', af: 'Fisiese Wetenskappe' },
  },
]

export const demoSchools: SchoolOption[] = [
  { id: 'demo-school-1', name: 'Demo High School', province: 'GP' },
  { id: 'demo-school-2', name: 'Sample Secondary School', province: 'GP' },
  { id: 'demo-school-3', name: 'Example College', province: 'WC' },
]

function subject(code: string, targetMark: number | null) {
  const found = demoSubjects.find((entry) => entry.code === code)
  if (!found) throw new Error(`Unknown demo subject ${code}`)
  return { ...found, targetMark }
}

export const demoLearner: LearnerProfile = {
  id: 'demo-thabo-mokoena',
  firstName: 'Thabo',
  lastName: 'Mokoena',
  grade: 12,
  province: 'GP',
  school: demoSchools[0] ?? null,
  schoolNameOther: null,
  isDemo: true,
  subjects: [subject('MATH', 70), subject('PHSC', 65), subject('ENHL', 75), subject('LO', null)],
  examDates: { trial: '2027-08-23', final: '2027-10-25' },
}

export const demoAccountState: AccountState = {
  isAdult: false,
  consentStatus: 'given',
  roles: ['learner'],
  onboardingStep: 5,
  onboarded: true,
  language: 'en',
}

export const demoFamily: FamilyLink[] = [
  {
    linkId: 'demo-link-nomsa',
    otherUserId: 'demo-parent-nomsa',
    otherFirstName: 'Nomsa',
    relation: 'parent',
    status: 'active',
    waitingOnMe: false,
    consentId: null,
  },
]

export const demoLibrary: LibraryItem[] = [
  {
    fileId: 'demo-book-en',
    kind: 'book',
    language: 'en',
    title: { en: 'Winning Strategies for Grade 12', af: 'Winning Strategies for Grade 12' },
    sizeBytes: 8_400_000,
    minTier: 'r99',
    unlocked: true,
  },
  {
    fileId: 'demo-book-af',
    kind: 'book',
    language: 'af',
    title: { en: 'Wenner Strategieë vir Graad 12', af: 'Wenner Strategieë vir Graad 12' },
    sizeBytes: 8_700_000,
    minTier: 'r99',
    unlocked: true,
  },
  {
    fileId: 'demo-planner-week',
    kind: 'planner',
    language: 'en',
    title: { en: 'Demo weekly study planner', af: 'Demo weeklikse studiebeplanner' },
    sizeBytes: 420_000,
    minTier: 'free',
    unlocked: true,
  },
  {
    fileId: 'demo-bonus-locked',
    kind: 'bonus',
    language: 'en',
    title: { en: 'Demo bonus file', af: 'Demo bonuslêer' },
    sizeBytes: 1_200_000,
    minTier: 'r199',
    unlocked: false,
  },
]

export const demoConsentRequest = {
  learnerFirstName: 'Thabo',
  requestedAt: '2026-11-20T08:00:00Z',
  expiresAt: '2026-12-20T08:00:00Z',
  status: 'pending',
}
