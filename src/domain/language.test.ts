import { describe, expect, it } from 'vitest'
import { isLanguage, resolveLanguage } from './language'

describe('language', () => {
  it('accepts only English and Afrikaans', () => {
    expect(isLanguage('en')).toBe(true)
    expect(isLanguage('af')).toBe(true)
    expect(isLanguage('zu')).toBe(false)
    expect(isLanguage(null)).toBe(false)
  })

  it('uses the first valid candidate, then English', () => {
    expect(resolveLanguage(null, 'xx', 'af', 'en')).toBe('af')
    expect(resolveLanguage(undefined)).toBe('en')
  })
})
