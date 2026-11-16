export const languages = ['en', 'af'] as const

export type Language = (typeof languages)[number]

export const defaultLanguage: Language = 'en'

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (languages as readonly string[]).includes(value)
}

export function resolveLanguage(...candidates: unknown[]): Language {
  return candidates.find(isLanguage) ?? defaultLanguage
}
