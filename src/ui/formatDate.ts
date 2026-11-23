import type { Language } from '../domain/language'

const locales: Record<Language, string> = { en: 'en-ZA', af: 'af-ZA' }

// Dates such as 2027-08-23 are calendar days, so they are shown without a time zone shift.
export function formatDate(value: string, language: Language): string {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00Z` : value
  return new Date(day).toLocaleDateString(locales[language], {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Africa/Johannesburg',
  })
}
