import { AppError } from '../data/errors'
import type { LearnerProfile, LearnerRepository } from '../data/learner'
import {
  demoAccountState,
  demoConsentRequest,
  demoFamily,
  demoLearner,
  demoLibrary,
  demoSchools,
  demoSubjects,
} from './thabo'

const demoInviteCode = 'DEMO2345'

// Serves every screen with the sample learner. Edits live in memory for this visit only,
// so nothing is ever written to real learner tables.
export function createDemoRepository(): LearnerRepository {
  let profile: LearnerProfile = structuredClone(demoLearner)
  let family = structuredClone(demoFamily)

  return {
    isDemo: true,

    getAccountState: async () => structuredClone(demoAccountState),
    declareAge: async () => undefined,
    claimParentRole: async () => undefined,
    claimEntitlements: async () => 0,

    getProfile: async () => structuredClone(profile),

    async updateProfile(update) {
      const school = demoSchools.find((entry) => entry.id === update.schoolId) ?? null
      profile = {
        ...profile,
        firstName: update.firstName,
        grade: update.grade,
        province: update.province,
        school: update.schoolNameOther ? null : school,
        schoolNameOther: update.schoolNameOther,
        examDates: { ...update.examDates },
        subjects: update.subjects.flatMap(({ subjectId, targetMark }) => {
          const found = demoSubjects.find((entry) => entry.id === subjectId)
          return found ? [{ ...found, targetMark }] : []
        }),
      }
      return structuredClone(profile)
    },

    listSubjects: async () => structuredClone(demoSubjects),

    async searchSchools(query, province) {
      const needle = query.trim().toLowerCase()
      return demoSchools.filter(
        (school) =>
          (!province || school.province === province) &&
          (!needle || school.name.toLowerCase().includes(needle)),
      )
    },

    getExamCalendar: async () => ({ ...demoLearner.examDates }),
    saveOnboarding: async () => undefined,

    requestConsent: async () => ({ consentId: 'demo-consent-request', sent: false }),
    getConsentRequest: async () => ({ ...demoConsentRequest }),
    giveConsent: async () => undefined,
    declineConsent: async () => undefined,

    getLibrary: async () => structuredClone(demoLibrary),
    async getDownloadLink() {
      throw new AppError('demo_unavailable')
    },

    getFamily: async () => structuredClone(family),
    createInvite: async () => ({
      code: demoInviteCode,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    }),
    async redeemInvite() {
      throw new AppError('demo_unavailable')
    },
    async acceptLink(linkId) {
      family = family.map((link) =>
        link.linkId === linkId ? { ...link, status: 'active', waitingOnMe: false } : link,
      )
    },
    async removeLink(linkId) {
      family = family.filter((link) => link.linkId !== linkId)
    },
  }
}
