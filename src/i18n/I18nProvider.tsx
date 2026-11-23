import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { defaultLanguage, isLanguage, type Language } from '../domain/language'
import { I18nContext, type I18nValue } from './context'
import { translate } from './messages'

const storageKey = 'ws12.language'

function readStoredLanguage(): Language | null {
  try {
    const stored = window.localStorage.getItem(storageKey)
    return isLanguage(stored) ? stored : null
  } catch {
    return null
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [stored] = useState(readStoredLanguage)
  const [language, setLanguageState] = useState<Language>(stored ?? defaultLanguage)
  const [choiceStored, setChoiceStored] = useState(stored !== null)

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next)
    setChoiceStored(true)
    try {
      window.localStorage.setItem(storageKey, next)
    } catch {
      // Private browsing can block storage; the choice still applies for this visit.
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = language
    document.title = translate(language, 'app.shortName')
  }, [language])

  const applyAccountLanguage = useCallback(
    (next: Language) => {
      if (!choiceStored) setLanguageState(next)
    },
    [choiceStored],
  )

  const value = useMemo<I18nValue>(
    () => ({
      language,
      setLanguage,
      choiceStored,
      applyAccountLanguage,
      t: (key, params) => translate(language, key, params),
    }),
    [language, setLanguage, choiceStored, applyAccountLanguage],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
