import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { resolveLanguage, type Language } from '../domain/language'
import { I18nContext, type I18nValue } from './context'
import { translate } from './messages'

const storageKey = 'ws12.language'

function readStoredLanguage(): Language {
  try {
    return resolveLanguage(window.localStorage.getItem(storageKey))
  } catch {
    return resolveLanguage()
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(readStoredLanguage)

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next)
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

  const value = useMemo<I18nValue>(
    () => ({ language, setLanguage, t: (key, params) => translate(language, key, params) }),
    [language, setLanguage],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
