import type { Language } from '../domain/language'
import af from './af.json'
import en from './en.json'

export type MessageKey = keyof typeof en
export type Messages = Record<MessageKey, string>
export type MessageParams = Record<string, string | number>

export const messages: Record<Language, Messages> = {
  en,
  af: af satisfies Messages,
}

export function translate(language: Language, key: MessageKey, params?: MessageParams): string {
  const template = messages[language][key]
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  )
}
