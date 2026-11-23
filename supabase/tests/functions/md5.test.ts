// @vitest-environment node
import { createHash, randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { md5Hex } from '../../functions/_shared/md5.ts'

describe('md5Hex', () => {
  it('matches the RFC 1321 test vectors', () => {
    expect(md5Hex('')).toBe('d41d8cd98f00b204e9800998ecf8427e')
    expect(md5Hex('abc')).toBe('900150983cd24fb0d6963f7d28e17f72')
    expect(md5Hex('message digest')).toBe('f96b697d7cb7938d525a2f31aaf161d0')
    expect(
      md5Hex('12345678901234567890123456789012345678901234567890123456789012345678901234567890'),
    ).toBe('57edf4a22be3c955ac49da2e2107b67a')
  })

  it('matches Node for random text of every length around the block size', () => {
    for (let length = 0; length < 200; length += 1) {
      const text = randomBytes(length).toString('base64').slice(0, length) + 'ë'
      expect(md5Hex(text), String(length)).toBe(
        createHash('md5').update(text, 'utf8').digest('hex'),
      )
    }
  })
})
