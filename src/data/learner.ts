import type { Language } from '../domain/language'

export interface SubjectSummary {
  code: string
  name: Record<Language, string>
}

export interface LearnerProfile {
  id: string
  firstName: string
  lastName?: string
  grade: number
  subjects: SubjectSummary[]
  isDemo: boolean
}

export interface LearnerRepository {
  getProfile(): Promise<LearnerProfile>
}
