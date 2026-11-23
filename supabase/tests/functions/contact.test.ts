// @vitest-environment node
import { createHash, randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  contactHash,
  decryptContact,
  encryptContact,
  importContactKey,
  isEmail,
  normalizeContact,
} from '../../functions/_shared/contact.ts'

const keyBase64 = () => randomBytes(32).toString('base64')

describe('contact rules', () => {
  it('normalises by trimming whitespace and lowercasing', () => {
    expect(normalizeContact('  Parent@Example.TEST\t\n')).toBe('parent@example.test')
    expect(normalizeContact('a b@c.d')).toBe('a b@c.d')
  })

  it('hashes with sha256 of the normalised contact, as hex', async () => {
    const expected = createHash('sha256').update('parent@example.test').digest('hex')
    expect(await contactHash(' PARENT@example.test ')).toBe(expected)
  })

  it('accepts plain email addresses only', () => {
    expect(isEmail('nomsa@example.co.za')).toBe(true)
    expect(isEmail(' Nomsa@Example.co.za ')).toBe(true)
    for (const value of ['', 'nomsa', 'nomsa@', '@example.test', 'no msa@example.test', 'a@b']) {
      expect(isEmail(value), value).toBe(false)
    }
    expect(isEmail(`${'a'.repeat(250)}@example.test`)).toBe(false)
  })
})

describe('contact encryption', () => {
  it('round trips and never stores the contact in clear text', async () => {
    const key = await importContactKey(keyBase64())
    const sealed = await encryptContact('Nomsa@Example.test', key)
    expect(sealed[0]).toBe(1)
    expect(Buffer.from(sealed).toString('latin1')).not.toContain('nomsa')
    expect(await decryptContact(sealed, key)).toBe('nomsa@example.test')
  })

  it('uses a fresh IV every time', async () => {
    const key = await importContactKey(keyBase64())
    const first = await encryptContact('nomsa@example.test', key)
    const second = await encryptContact('nomsa@example.test', key)
    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(false)
  })

  it('fails with the wrong key or a changed byte', async () => {
    const key = await importContactKey(keyBase64())
    const sealed = await encryptContact('nomsa@example.test', key)
    await expect(decryptContact(sealed, await importContactKey(keyBase64()))).rejects.toThrow()
    const tampered = sealed.slice()
    tampered[tampered.length - 1] = tampered[tampered.length - 1]! ^ 1
    await expect(decryptContact(tampered, key)).rejects.toThrow()
  })

  it('needs a 32 byte key', async () => {
    await expect(importContactKey(randomBytes(16).toString('base64'))).rejects.toThrow(/32 bytes/)
  })
})
