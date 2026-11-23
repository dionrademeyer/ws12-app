// Parent contact rules shared with the database (public.normalize_contact, public.contact_hash
// and public.consent_policy_version in the Sprint 2 migration). A test checks both sides agree.

export const CONSENT_POLICY_VERSION = 'draft-2026-11'

const edgeWhitespace = /^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g

export function normalizeContact(contact: string): string {
  return contact.replace(edgeWhitespace, '').toLowerCase()
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return toHex(new Uint8Array(digest))
}

export function contactHash(contact: string): Promise<string> {
  return sha256Hex(normalizeContact(contact))
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isEmail(value: string): boolean {
  const email = normalizeContact(value)
  return email.length <= 254 && emailPattern.test(email)
}

// Stored contacts are AES-256-GCM encrypted. Layout: one version byte, a 12 byte IV, then the
// ciphertext with its tag. The key is 32 bytes, base64 encoded, from CONSENT_CONTACT_KEY.
const formatVersion = 1
const ivLength = 12

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

export type ContactKey = Awaited<ReturnType<typeof crypto.subtle.importKey>>

export async function importContactKey(base64Key: string): Promise<ContactKey> {
  const raw = base64ToBytes(base64Key)
  if (raw.length !== 32) throw new Error('CONSENT_CONTACT_KEY must be 32 bytes, base64 encoded')
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export async function encryptContact(contact: string, key: ContactKey): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(ivLength))
  const plain = new TextEncoder().encode(normalizeContact(contact))
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain))
  const output = new Uint8Array(1 + ivLength + sealed.length)
  output[0] = formatVersion
  output.set(iv, 1)
  output.set(sealed, 1 + ivLength)
  return output
}

export async function decryptContact(stored: Uint8Array, key: ContactKey): Promise<string> {
  if (stored[0] !== formatVersion) throw new Error('unknown contact format')
  const iv = stored.slice(1, 1 + ivLength)
  const sealed = stored.slice(1 + ivLength)
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, sealed)
  return new TextDecoder().decode(plain)
}
