// stripe-webhook: Stripe events, test mode only (CLAUDE.md). Verifies the Stripe-Signature
// header (HMAC SHA-256 over "timestamp.body" with a 300 second tolerance), then records
// checkout.session.completed and charge.refunded through public.record_payment.
//
// Our checkout (create-checkout, later sprint) puts the product code in the session metadata
// as product_code.

import { sha256Hex, toHex } from './contact.ts'
import type { EnvReader } from './http.ts'
import { jsonResponse } from './http.ts'
import { isAccepted, timingSafeEqual, type PaymentRecord, type RecordPayment } from './payments.ts'

export const STRIPE_TOLERANCE_SECONDS = 300

export interface StripeConfig {
  webhookSecret: string
}

export type StripeConfigResult = { ok: true; config: StripeConfig } | { ok: false; reason: string }

export function readStripeConfig(env: EnvReader): StripeConfigResult {
  if (!env('STRIPE_SECRET_KEY')?.startsWith('sk_test_')) {
    return { ok: false, reason: 'STRIPE_SECRET_KEY must be a test key until Didi approves live' }
  }
  const webhookSecret = env('STRIPE_WEBHOOK_SECRET')
  if (!webhookSecret) return { ok: false, reason: 'STRIPE_WEBHOOK_SECRET is required' }
  return { ok: true, config: { webhookSecret } }
}

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return toHex(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(message))))
}

export type SignatureCheck = 'valid' | 'missing' | 'invalid' | 'too_old'

export async function verifyStripeSignature(options: {
  payload: string
  header: string | null
  secret: string
  nowSeconds: number
  toleranceSeconds?: number
}): Promise<SignatureCheck> {
  const { payload, header, secret, nowSeconds } = options
  const tolerance = options.toleranceSeconds ?? STRIPE_TOLERANCE_SECONDS
  if (!header) return 'missing'

  let timestamp: number | null = null
  const signatures: string[] = []
  for (const part of header.split(',')) {
    const [key, value] = part.split('=', 2).map((item) => item.trim())
    if (key === 't' && value && /^\d+$/.test(value)) timestamp = Number(value)
    if (key === 'v1' && value) signatures.push(value)
  }
  if (timestamp === null || signatures.length === 0) return 'missing'

  const expected = await hmacSha256Hex(secret, `${timestamp}.${payload}`)
  if (!signatures.some((signature) => timingSafeEqual(signature, expected))) return 'invalid'
  if (Math.abs(nowSeconds - timestamp) > tolerance) return 'too_old'
  return 'valid'
}

interface StripeEvent {
  id?: unknown
  type?: unknown
  livemode?: unknown
  data?: { object?: Record<string, unknown> }
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

// Maps a verified event to a payment record, or null when the event is not one we act on.
export function stripeEventToRecord(
  event: StripeEvent,
  payloadHash: string,
): PaymentRecord | 'invalid' | null {
  const eventId = stringOrNull(event.id)
  const object = event.data?.object
  if (!eventId || !object) return 'invalid'

  if (event.type === 'checkout.session.completed') {
    if (object.payment_status !== 'paid') return null
    if (object.currency !== 'zar' || typeof object.amount_total !== 'number') return 'invalid'
    const metadata = (object.metadata ?? {}) as Record<string, unknown>
    const details = (object.customer_details ?? {}) as Record<string, unknown>
    return {
      provider: 'stripe',
      eventId,
      payloadHash,
      providerRef: stringOrNull(object.payment_intent) ?? stringOrNull(object.id) ?? '',
      outcome: 'paid',
      productCode: stringOrNull(metadata.product_code),
      buyerEmail: stringOrNull(details.email) ?? stringOrNull(object.customer_email),
      amountCents: object.amount_total,
    }
  }

  if (event.type === 'charge.refunded') {
    // Only a full refund removes access; a partial refund is left for support to decide.
    if (object.refunded !== true) return null
    const paymentIntent = stringOrNull(object.payment_intent)
    if (!paymentIntent) return 'invalid'
    return {
      provider: 'stripe',
      eventId,
      payloadHash,
      providerRef: paymentIntent,
      outcome: 'refunded',
      productCode: null,
      buyerEmail: null,
      amountCents: null,
    }
  }

  return null
}

export interface StripeWebhookDeps {
  config: StripeConfigResult
  recordPayment: RecordPayment
  nowSeconds?: () => number
}

export function createStripeWebhookHandler(deps: StripeWebhookDeps) {
  return async (request: Request): Promise<Response> => {
    if (!deps.config.ok) return jsonResponse(503, { error: 'not_configured' })
    if (request.method !== 'POST') return jsonResponse(405, { error: 'method_not_allowed' })

    const payload = await request.text()
    const check = await verifyStripeSignature({
      payload,
      header: request.headers.get('Stripe-Signature'),
      secret: deps.config.config.webhookSecret,
      nowSeconds: deps.nowSeconds?.() ?? Math.floor(Date.now() / 1000),
    })
    if (check !== 'valid') return jsonResponse(400, { error: 'invalid_signature' })

    let event: StripeEvent
    try {
      event = JSON.parse(payload) as StripeEvent
    } catch {
      return jsonResponse(400, { error: 'invalid_input' })
    }
    if (event.livemode !== false) return jsonResponse(400, { error: 'live_mode_refused' })

    const record = stripeEventToRecord(event, await sha256Hex(payload))
    if (record === 'invalid') return jsonResponse(400, { error: 'invalid_input' })
    if (record === null) return jsonResponse(200, { received: true, ignored: true })

    const result = await deps.recordPayment(record)
    if (!isAccepted(result)) return jsonResponse(400, { error: result })
    return jsonResponse(200, { received: true, result })
  }
}
