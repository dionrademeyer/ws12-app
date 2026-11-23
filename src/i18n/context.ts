import { createContext } from 'react'
import type { Language } from '../domain/language'
import type { MessageKey, MessageParams } from './messages'

export interface I18nValue {
  language: Language
  // The person's own choice, kept on this device.
  setLanguage: (language: Language) => void
  // True once this device keeps a language the person chose.
  choiceStored: boolean
  // Uses the language saved to the account, unless this device keeps a choice of its own.
  applyAccountLanguage: (language: Language) => void
  t: (key: MessageKey, params?: MessageParams) => string
}

export const I18nContext = createContext<I18nValue | null>(null)
