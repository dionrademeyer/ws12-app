// payfast-itn: PayFast Instant Transaction Notifications, sandbox only (CLAUDE.md).
// Checks, in order: sandbox configuration, source IP, signature with the passphrase, merchant
// id, amount format, and PayFast's own validate call. The product price check and the
// idempotent write happen in public.record_payment.
//
// Our checkout (create-checkout, later sprint) sends the product code in custom_str1 and the
// buyer's email in email_address, and uses m_payment_id as our own reference.

import { sha256Hex } from './contact.ts'
import type { EnvReader } from './http.ts'
import { md5Hex } from './md5.ts'
import { isAccepted, timingSafeEqual, type PaymentOutcome, type RecordPayment } from './payments.ts'

export const PAYFAST_SANDBOX_VALIDATE_URL = 'https://sandbox.payfast.co.za/eng/query/validate'

// PayFast's published notification source ranges. Check them against PayFast's current
// documentation before going live; PAYFAST_ALLOWED_IPS overrides this list.
export const PAYFAST_SOURCE_RANGES = [
  '197.97.145.144/28',
  '41.74.179.192/27',
  '102.216.36.0/28',
  '102.216.36.128/28',
  '144.126.193.139/32',
]

export interface PayfastConfig {
  merchantId: string
  passphrase: string
  allowedRanges: string[]
}

export type PayfastConfigResult =
  { ok: true; config: PayfastConfig } | { ok: false; reason: string }

export function readPayfastConfig(env: EnvReader): PayfastConfigResult {
  if (env('PAYFAST_MODE') !== 'sandbox') {
    return { ok: false, reason: 'PAYFAST_MODE must be sandbox until Didi approves live payments' }
  }
  const merchantId = env('PAYFAST_MERCHANT_ID')
  const passphrase = env('PAYFAST_PASSPHRASE')
  if (!merchantId || !passphrase) {
    return { ok: false, reason: 'PAYFAST_MERCHANT_ID and PAYFAST_PASSPHRASE are required' }
  }
  const override = env('PAYFAST_ALLOWED_IPS')
  const allowedRanges = override
    ? override
        .split(',')
        .map((range) => range.trim())
        .filter(Boolean)
    : PAYFAST_SOURCE_RANGES
  return { ok: true, config: { merchantId, passphrase, allowedRanges } }
}

// PHP urlencode(), which PayFast uses to build the signed string: everything except letters,
// digits and "-_." is percent encoded with capital hex, and spaces become "+".
export function phpUrlEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/[!'()*~]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%20/g, '+')
}

// Every posted field except the signature, in the order PayFast sent them.
export function payfastParamString(fields: [string, string][]): string {
  return fields
    .filter(([key]) => key !== 'signature')
    .map(([key, value]) => `${key}=${phpUrlEncode(value)}`)
    .join('&')
}

export function payfastSignature(fields: [string, string][], passphrase: string): string {
  return md5Hex(`${payfastParamString(fields)}&passphrase=${phpUrlEncode(passphrase.trim())}`)
}

function ipv4ToNumber(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  let value = 0
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null
    const octet = Number(part)
    if (octet > 255) return null
    value = value * 256 + octet
  }
  return value
}

export function ipInRanges(ip: string, ranges: readonly string[]): boolean {
  const address = ipv4ToNumber(ip)
  if (address === null) return false
  return ranges.some((range) => {
    const [base = '', bitsText = '32'] = range.split('/')
    const start = ipv4ToNumber(base)
    const bits = Number(bitsText)
    if (start === null || !Number.isInteger(bits) || bits < 0 || bits > 32) return false
    const size = 2 ** (32 - bits)
    const first = Math.floor(start / size) * size
    return address >= first && address < first + size
  })
}

// The first address in X-Forwarded-For, as set by the Supabase edge gateway.
export function forwardedClientIp(request: Request): string | null {
  const forwarded = request.headers.get('X-Forwarded-For')
  const first = forwarded?.split(',')[0]?.trim()
  return first || null
}

// "99.00" to 9900, without floating point.
export function parseAmountCents(value: string | undefined): number | null {
  const match = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(value ?? '')
  if (!match) return null
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
}

const outcomes: Record<string, PaymentOutcome> = {
  COMPLETE: 'paid',
  FAILED: 'failed',
  CANCELLED: 'failed',
}

export interface PayfastItnDeps {
  config: PayfastConfigResult
  // PayFast's server confirmation: posts the param string to the sandbox validate URL.
  validate(paramString: string): Promise<boolean>
  recordPayment: RecordPayment
  clientIp(request: Request): string | null
}

function text(status: number, body: string): Response {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain' } })
}

export function createPayfastItnHandler(deps: PayfastItnDeps) {
  return async (request: Request): Promise<Response> => {
    if (!deps.config.ok) return text(503, 'not configured')
    const { config } = deps.config
    if (request.method !== 'POST') return text(405, 'method not allowed')

    const ip = deps.clientIp(request)
    if (!ip || !ipInRanges(ip, config.allowedRanges)) return text(403, 'forbidden')

    const raw = await request.text()
    const fields = [...new URLSearchParams(raw).entries()]
    const field = (name: string) => fields.find(([key]) => key === name)?.[1]

    const signature = (field('signature') ?? '').toLowerCase()
    if (!timingSafeEqual(signature, payfastSignature(fields, config.passphrase))) {
      return text(400, 'invalid signature')
    }
    if (field('merchant_id') !== config.merchantId) return text(400, 'wrong merchant')

    const outcome = outcomes[field('payment_status') ?? '']
    if (!outcome) return text(200, 'OK')

    const pfPaymentId = field('pf_payment_id')
    const reference = field('m_payment_id')
    const amountCents = parseAmountCents(field('amount_gross'))
    if (!pfPaymentId || !reference || amountCents === null) return text(400, 'invalid input')

    if (!(await deps.validate(payfastParamString(fields)))) return text(400, 'not validated')

    const result = await deps.recordPayment({
      provider: 'payfast',
      eventId: `payfast:${pfPaymentId}:${field('payment_status')}`,
      payloadHash: await sha256Hex(raw),
      providerRef: reference,
      outcome,
      productCode: field('custom_str1') ?? null,
      buyerEmail: field('email_address') ?? null,
      amountCents,
    })
    return isAccepted(result) ? text(200, 'OK') : text(400, result)
  }
}
