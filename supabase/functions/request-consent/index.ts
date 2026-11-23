import { serviceClient, userClient } from '../_shared/clients.ts'
import { toHex } from '../_shared/contact.ts'
import { codedOrThrow } from '../_shared/http.ts'
import { createRequestConsentHandler, readRequestConsentConfig } from '../_shared/requestConsent.ts'

const service = serviceClient()

const handler = createRequestConsentHandler({
  config: await readRequestConsentConfig((name) => Deno.env.get(name)),
  async requestConsent(authorization, contactHash, policyVersion) {
    const { data, error } = await userClient(authorization).rpc('request_consent', {
      p_contact_hash: contactHash,
      p_policy_version: policyVersion,
    })
    codedOrThrow(error)
    return data as string
  },
  async storeContact(consentId, channel, encrypted) {
    const { error } = await service.rpc('store_consent_contact', {
      p_consent_id: consentId,
      p_channel: channel,
      p_contact_encrypted: `\\x${toHex(encrypted)}`,
    })
    codedOrThrow(error)
  },
})

Deno.serve(handler)
