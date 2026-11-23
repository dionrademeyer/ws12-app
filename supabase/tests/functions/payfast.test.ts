// @vitest-environment node
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  ipInRanges,
  parseAmountCents,
  PAYFAST_SOURCE_RANGES,
  payfastParamString,
  payfastSignature,
  phpUrlEncode,
  readPayfastConfig,
} from '../../functions/_shared/payfast.ts'

const fields: [string, string][] = [
  ['merchant_id', '10000100'],
  ['m_payment_id', 'WS12-0001'],
  ['pf_payment_id', '1089250'],
  ['payment_status', 'COMPLETE'],
  ['item_name', 'WS12 Book (EN)'],
  ['amount_gross', '99.00'],
  ['amount_fee', '-2.28'],
  ['amount_net', '96.72'],
  ['custom_str1', 'ws12-r99'],
  ['email_address', 'nomsa@example.test'],
]

describe('PayFast signature', () => {
  it('encodes like PHP urlencode', () => {
    expect(phpUrlEncode("A b-_.~!*'()@+/")).toBe('A+b-_.%7E%21%2A%27%28%29%40%2B%2F')
  })

  it('signs the fields in order with the passphrase, matching a hand-built string', () => {
    const expectedString =
      'merchant_id=10000100&m_payment_id=WS12-0001&pf_payment_id=1089250' +
      '&payment_status=COMPLETE&item_name=WS12+Book+%28EN%29&amount_gross=99.00' +
      '&amount_fee=-2.28&amount_net=96.72&custom_str1=ws12-r99' +
      '&email_address=nomsa%40example.test'
    expect(payfastParamString([...fields, ['signature', 'ignored']])).toBe(expectedString)
    const expected = createHash('md5')
      .update(`${expectedString}&passphrase=sandbox+pass`)
      .digest('hex')
    expect(payfastSignature(fields, ' sandbox pass ')).toBe(expected)
  })

  it('changes when any field, the order or the passphrase changes', () => {
    const signature = payfastSignature(fields, 'pass')
    const changedAmount = fields.map(([key, value]): [string, string] =>
      key === 'amount_gross' ? [key, '9.00'] : [key, value],
    )
    expect(payfastSignature(changedAmount, 'pass')).not.toBe(signature)
    expect(payfastSignature([...fields].reverse(), 'pass')).not.toBe(signature)
    expect(payfastSignature(fields, 'other')).not.toBe(signature)
  })
})

describe('PayFast source addresses', () => {
  it('allows addresses inside the published ranges only', () => {
    for (const ip of [
      '197.97.145.144',
      '197.97.145.159',
      '41.74.179.200',
      '102.216.36.5',
      '144.126.193.139',
    ]) {
      expect(ipInRanges(ip, PAYFAST_SOURCE_RANGES), ip).toBe(true)
    }
    for (const ip of [
      '197.97.145.160',
      '41.74.179.224',
      '144.126.193.140',
      '10.0.0.1',
      '::1',
      'x',
      '1.2.3',
    ]) {
      expect(ipInRanges(ip, PAYFAST_SOURCE_RANGES), ip).toBe(false)
    }
  })
})

describe('PayFast amounts', () => {
  it('parses rand amounts to cents without floating point', () => {
    expect(parseAmountCents('99.00')).toBe(9900)
    expect(parseAmountCents('349.9')).toBe(34990)
    expect(parseAmountCents('199')).toBe(19900)
    expect(parseAmountCents('0.29')).toBe(29)
    for (const value of ['', '-1.00', '1.234', '1e3', 'R99', undefined]) {
      expect(parseAmountCents(value), String(value)).toBeNull()
    }
  })
})

describe('PayFast configuration', () => {
  const env = (values: Record<string, string>) => (name: string) => values[name]

  it('refuses to run unless the mode is sandbox', () => {
    const base = { PAYFAST_MERCHANT_ID: '10000100', PAYFAST_PASSPHRASE: 'pass' }
    expect(readPayfastConfig(env({ ...base, PAYFAST_MODE: 'live' })).ok).toBe(false)
    expect(readPayfastConfig(env(base)).ok).toBe(false)
    expect(readPayfastConfig(env({ ...base, PAYFAST_MODE: 'sandbox' }))).toEqual({
      ok: true,
      config: { merchantId: '10000100', passphrase: 'pass', allowedRanges: PAYFAST_SOURCE_RANGES },
    })
  })

  it('needs the merchant id and passphrase, and accepts an address override', () => {
    expect(readPayfastConfig(env({ PAYFAST_MODE: 'sandbox', PAYFAST_MERCHANT_ID: '1' })).ok).toBe(
      false,
    )
    const config = readPayfastConfig(
      env({
        PAYFAST_MODE: 'sandbox',
        PAYFAST_MERCHANT_ID: '1',
        PAYFAST_PASSPHRASE: 'p',
        PAYFAST_ALLOWED_IPS: '10.0.0.0/8, 192.168.1.1/32',
      }),
    )
    expect(config.ok && config.config.allowedRanges).toEqual(['10.0.0.0/8', '192.168.1.1/32'])
  })
})
