// Small HTTP helpers shared by the edge functions.

export const appErrorCodes = [
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

export type AppErrorCode = (typeof appErrorCodes)[number]

export function isAppErrorCode(value: unknown): value is AppErrorCode {
  return typeof value === 'string' && (appErrorCodes as readonly string[]).includes(value)
}

// A database or dependency error that carries one of the stable codes.
export class CodedError extends Error {
  readonly code: AppErrorCode

  constructor(code: AppErrorCode) {
    super(code)
    this.code = code
  }
}

// Turns a PostgREST error from supabase-js into a CodedError when its message is a stable code.
export function codedOrThrow(error: { message?: string } | null): void {
  if (!error) return
  const message = error.message?.trim()
  if (isAppErrorCode(message)) throw new CodedError(message)
  throw new Error(message || 'database error')
}

const statusForCode: Record<AppErrorCode, number> = {
  not_signed_in: 401,
  consent_required: 403,
  not_allowed: 403,
  invalid_input: 400,
  invalid_code: 400,
  code_expired: 400,
  rate_limited: 429,
  already_linked: 409,
  email_not_verified: 403,
  contact_mismatch: 403,
  consent_expired: 410,
  not_found: 404,
}

export function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

export function errorResponse(
  code: AppErrorCode,
  extra: Record<string, unknown> = {},
  headers: Record<string, string> = {},
): Response {
  return jsonResponse(statusForCode[code], { error: code, ...extra }, headers)
}

// CORS for functions the app calls from the browser. Only listed origins are echoed back.
export function corsHeaders(request: Request, allowedOrigins: readonly string[]) {
  const origin = request.headers.get('Origin')
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
  if (origin && allowedOrigins.includes(origin)) headers['Access-Control-Allow-Origin'] = origin
  return headers
}

export function parseOrigins(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json()
    return body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

export type EnvReader = (name: string) => string | undefined
