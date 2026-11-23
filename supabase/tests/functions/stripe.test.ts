// @vitest-environment node
import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { readStripeConfig, verifyStripeSignature } from '../../functions/_shared/stripe.ts'

const secret = 'whsec_test_secret'
const payload = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed' })
const now = 1_800_000_000

function sign(timestamp: number, body = payload, key = secret) {
  return createHmac('sha256', key).update(`${timestamp}.${body}`).digest('hex')
}

describe('Stripe-Signature verification', () => {
  const verify = (header: string | null, nowSeconds = now, body = payload) =>
    verifyStripeSignature({ payload: body, header, secret, nowSeconds })

  it('accepts a correct signature inside the tolerance', async () => {
    expect(await verify(`t=${now},v1=${sign(now)}`)).toBe('valid')
    expect(await verify(`t=${now - 299},v1=${sign(now - 299)}`)).toBe('valid')
  })

  it('accepts when any of several v1 signatures matches, as during secret rotation', async () => {
    expect(await verify(`t=${now},v1=${'0'.repeat(64)},v1=${sign(now)},v0=abc`)).toBe('valid')
  })

  it('refuses a wrong secret, a changed body or a changed timestamp', async () => {
    expect(await verify(`t=${now},v1=${sign(now, payload, 'whsec_other')}`)).toBe('invalid')
    expect(await verify(`t=${now},v1=${sign(now)}`, now, `${payload} `)).toBe('invalid')
    expect(await verify(`t=${now + 1},v1=${sign(now)}`, now)).toBe('invalid')
  })

  it('refuses an old or future timestamp outside 300 seconds', async () => {
    expect(await verify(`t=${now - 301},v1=${sign(now - 301)}`)).toBe('too_old')
    expect(await verify(`t=${now + 301},v1=${sign(now + 301)}`)).toBe('too_old')
  })

  it('refuses a missing or malformed header', async () => {
    expect(await verify(null)).toBe('missing')
    expect(await verify('')).toBe('missing')
    expect(await verify(`v1=${sign(now)}`)).toBe('missing')
    expect(await verify(`t=${now}`)).toBe('missing')
    expect(await verify(`t=${now},v0=${sign(now)}`)).toBe('missing')
  })
})

describe('Stripe configuration', () => {
  const env = (values: Record<string, string>) => (name: string) => values[name]

  it('refuses to run without a test mode secret key', () => {
    expect(
      readStripeConfig(env({ STRIPE_SECRET_KEY: 'sk_live_abc', STRIPE_WEBHOOK_SECRET: secret })).ok,
    ).toBe(false)
    expect(readStripeConfig(env({ STRIPE_WEBHOOK_SECRET: secret })).ok).toBe(false)
    expect(readStripeConfig(env({ STRIPE_SECRET_KEY: 'sk_test_abc' })).ok).toBe(false)
    expect(
      readStripeConfig(env({ STRIPE_SECRET_KEY: 'sk_test_abc', STRIPE_WEBHOOK_SECRET: secret })),
    ).toEqual({
      ok: true,
      config: { webhookSecret: secret },
    })
  })
})
