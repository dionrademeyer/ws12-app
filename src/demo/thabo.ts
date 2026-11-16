import type { LearnerProfile } from '../data/learner'

// Sample learner for demo mode (Product Bible 3.23). Shown only with the demo banner and never
// written to real learner tables.
export const demoLearner: LearnerProfile = {
  id: 'demo-thabo-mokoena',
  firstName: 'Thabo',
  lastName: 'Mokoena',
  grade: 12,
  isDemo: true,
  subjects: [
    { code: 'MATH', name: { en: 'Mathematics', af: 'Wiskunde' } },
    { code: 'PHSC', name: { en: 'Physical Sciences', af: 'Fisiese Wetenskappe' } },
    { code: 'ENHL', name: { en: 'English Home Language', af: 'Engels Huistaal' } },
    { code: 'LO', name: { en: 'Life Orientation', af: 'Lewensoriëntering' } },
  ],
}
