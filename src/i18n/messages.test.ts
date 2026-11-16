import { describe, expect, it } from 'vitest'
import af from './af.json'
import en from './en.json'
import { translate } from './messages'

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

describe('messages', () => {
  it('has the same keys in English and Afrikaans', () => {
    expect(Object.keys(af).sort()).toEqual(Object.keys(en).sort())
  })

  it('has no empty strings and the same placeholders in both languages', () => {
    for (const [key, english] of Object.entries(en)) {
      const afrikaans = af[key as keyof typeof af]
      expect(english.trim(), key).not.toBe('')
      expect(afrikaans.trim(), key).not.toBe('')
      expect(placeholders(afrikaans), key).toEqual(placeholders(english))
    }
  })

  it('follows the copy rules: no ampersands and no em or en dashes', () => {
    for (const text of [...Object.values(en), ...Object.values(af)]) {
      expect(text).not.toMatch(/[&\u2013\u2014]/)
    }
  })

  it('uses the official Afrikaans product name', () => {
    expect(af['app.name']).toBe('Wenner Strategieë vir Graad 12')
  })

  it('fills in parameters', () => {
    expect(translate('en', 'dashboard.greeting', { name: 'Thabo' })).toBe('Hi Thabo')
    expect(translate('af', 'profile.grade', { grade: 12 })).toBe('Graad 12')
  })
})
