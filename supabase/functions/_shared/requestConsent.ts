// request-consent: a learner under 18 asks a parent for consent (Product Bible 3.3).
// The contact is hashed for the database check in give_consent(), and stored encrypted only so
// that Resend can work. Sending real messages stays off unless CONSENT_SENDING_ENABLED is
// "true" and a sender is wired in, which needs Didi's approval.

import {
  CONSENT_POLICY_VERSION,
  contactHash,
  encryptContact,
  importContactKey,
  isEmail,
  type ContactKey,
} from './contact.ts'
import {
  CodedError,
  corsHeaders,
  errorResponse,
  jsonResponse,
  parseOrigins,
  readJsonObject,
  type EnvReader,
} from './http.ts'

export interface RequestConsentConfig {
  contactKey: ContactKey
  sendingEnabled: boolean
  allowedOrigins: string[]
}

export interface ConsentMessage {
  consentId: string
  channel: 'email'
  contact: string
}

export interface RequestConsentDeps {
  config: RequestConsentConfig
  // Calls public.request_consent with the caller's session and returns the consent id.
  requestConsent(authorization: string, contactHash: string, policyVersion: string): Promise<string>
  // Calls public.store_consent_contact with the service role.
  storeContact(consentId: string, channel: 'email', encrypted: Uint8Array): Promise<void>
  sendConsentMessage?: (message: ConsentMessage) => Promise<void>
}

export async function readRequestConsentConfig(env: EnvReader): Promise<RequestConsentConfig> {
  const key = env('CONSENT_CONTACT_KEY')
  if (!key) throw new Error('CONSENT_CONTACT_KEY is not set')
  return {
    contactKey: await importContactKey(key),
    sendingEnabled: env('CONSENT_SENDING_ENABLED') === 'true',
    allowedOrigins: parseOrigins(env('ALLOWED_ORIGINS')),
  }
}

export function createRequestConsentHandler(deps: RequestConsentDeps) {
  return async (request: Request): Promise<Response> => {
    const cors = corsHeaders(request, deps.config.allowedOrigins)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    if (request.method !== 'POST') return errorResponse('invalid_input', {}, cors)

    const authorization = request.headers.get('Authorization') ?? ''
    if (!authorization.startsWith('Bearer ')) return errorResponse('not_signed_in', {}, cors)

    const body = await readJsonObject(request)
    const contact = typeof body?.contact === 'string' ? body.contact : ''
    if (body?.channel !== 'email' || !isEmail(contact)) {
      return errorResponse('invalid_input', {}, cors)
    }

    try {
      const hash = await contactHash(contact)
      const consentId = await deps.requestConsent(authorization, hash, CONSENT_POLICY_VERSION)
      const encrypted = await encryptContact(contact, deps.config.contactKey)
      await deps.storeContact(consentId, 'email', encrypted)

      let sent = false
      if (deps.config.sendingEnabled && deps.sendConsentMessage) {
        await deps.sendConsentMessage({ consentId, channel: 'email', contact })
        sent = true
      }
      return jsonResponse(200, { consent_id: consentId, sent }, cors)
    } catch (error) {
      if (error instanceof CodedError) return errorResponse(error.code, {}, cors)
      throw error
    }
  }
}
