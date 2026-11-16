import { createContext } from 'react'
import type { Language } from '../domain/language'
import type { MessageKey, MessageParams } from './messages'

export interface I18nValue {
  language: Language
  setLanguage: (language: Language) => void
  t: (key: MessageKey, params?: MessageParams) => string
}

export const I18nContext = createContext<I18nValue | null>(null)
