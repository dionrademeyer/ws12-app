// What both payment webhooks hand to public.record_payment, and what it answers.

export type PaymentProvider = 'payfast' | 'stripe'
export type PaymentOutcome = 'paid' | 'refunded' | 'failed'

export interface PaymentRecord {
  provider: PaymentProvider
  eventId: string
  payloadHash: string
  providerRef: string
  outcome: PaymentOutcome
  productCode: string | null
  buyerEmail: string | null
  amountCents: number | null
}

export const recordPaymentResults = [
  'recorded',
  'duplicate',
  'amount_mismatch',
  'unknown_product',
  'unknown_purchase',
  'ignored',
  'invalid_input',
] as const

export type RecordPaymentResult = (typeof recordPaymentResults)[number]

export type RecordPayment = (record: PaymentRecord) => Promise<RecordPaymentResult>

export function isRecordPaymentResult(value: unknown): value is RecordPaymentResult {
  return typeof value === 'string' && (recordPaymentResults as readonly string[]).includes(value)
}

// Results that mean the event was handled (or safely skipped), so the provider should not
// retry it. The others are refused with a 400.
export function isAccepted(result: RecordPaymentResult): boolean {
  return (
    result === 'recorded' ||
    result === 'duplicate' ||
    result === 'unknown_purchase' ||
    result === 'ignored'
  )
}

export function recordPaymentArgs(record: PaymentRecord) {
  return {
    p_provider: record.provider,
    p_event_id: record.eventId,
    p_payload_hash: record.payloadHash,
    p_provider_ref: record.providerRef,
    p_outcome: record.outcome,
    p_product_code: record.productCode,
    p_buyer_email: record.buyerEmail,
    p_amount_cents: record.amountCents,
  }
}

// Constant time comparison for signatures of the same length.
export function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return difference === 0
}
