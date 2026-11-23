// Stable error codes from docs/api-contract.md, plus the few the app adds for its own cases.
export const contractErrorCodes = [
  'not_signed_in',
  'consent_required',
  'not_allowed',
  'invalid_input',
  'invalid_code',
  'code_expired',
  'rate_limited',
  'already_linked',
  'email_not_verified',
  'contact_mismatch',
  'consent_expired',
  'not_found',
] as const

const appErrorCodes = [
  'invalid_credentials',
  'email_taken',
  'weak_password',
  'not_configured',
  'demo_unavailable',
  'network',
  'unknown',
] as const

export type ContractErrorCode = (typeof contractErrorCodes)[number]
export type ErrorCode = ContractErrorCode | (typeof appErrorCodes)[number]

const knownCodes = new Set<string>([...contractErrorCodes, ...appErrorCodes])

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && knownCodes.has(value)
}

export class AppError extends Error {
  readonly code: ErrorCode
  readonly purchaseRef?: string

  constructor(code: ErrorCode, options: { purchaseRef?: string; cause?: unknown } = {}) {
    super(code, { cause: options.cause })
    this.name = 'AppError'
    this.code = code
    this.purchaseRef = options.purchaseRef
  }
}

export function errorCodeOf(error: unknown): ErrorCode {
  if (error instanceof AppError) return error.code
  return 'unknown'
}
