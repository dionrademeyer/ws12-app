import { useCallback } from 'react'
import type { Language } from '../domain/language'
import type { AccountState, LearnerRepository } from '../data/learner'
import { useI18n } from '../i18n/useI18n'
import { useSession } from './useSession'

// Saving the language never blocks the screen: a failure is tried again on the next change
// or sign-in.
function saveLanguage(repository: LearnerRepository, language: Language) {
  repository.setLanguage(language).catch(() => undefined)
}

// After sign-in: a choice kept on this device is saved to the account, otherwise the
// account's saved language is used.
export function useSyncAccountLanguage() {
  const { language, choiceStored, applyAccountLanguage } = useI18n()
  return useCallback(
    (state: AccountState, repository: LearnerRepository) => {
      if (repository.isDemo) return
      if (!choiceStored) applyAccountLanguage(state.language)
      else if (state.language !== language) saveLanguage(repository, language)
    },
    [language, choiceStored, applyAccountLanguage],
  )
}

// The language switch: applies the choice straight away and saves it to a signed-in account.
export function useChooseLanguage() {
  const { language, setLanguage } = useI18n()
  const { mode, repository } = useSession()
  return useCallback(
    (next: Language) => {
      const changed = next !== language
      setLanguage(next)
      if (changed && mode === 'signed-in' && repository && !repository.isDemo) {
        saveLanguage(repository, next)
      }
    },
    [language, setLanguage, mode, repository],
  )
}
