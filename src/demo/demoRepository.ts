import type { LearnerRepository } from '../data/learner'
import { demoLearner } from './thabo'

export function createDemoRepository(): LearnerRepository {
  return {
    getProfile: async () => structuredClone(demoLearner),
  }
}
