// Supabase clients for the edge functions. The user client carries the caller's session, so
// database functions see auth.uid() and Row Level Security applies. The service client is used
// only for writes that clients may never make (consent contacts, payments, signed links).

import { createClient } from 'npm:@supabase/supabase-js@2'

function required(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`${name} is not set`)
  return value
}

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } }

export function userClient(authorization: string) {
  return createClient(required('SUPABASE_URL'), required('SUPABASE_ANON_KEY'), {
    ...clientOptions,
    global: { headers: { Authorization: authorization } },
  })
}

export function serviceClient() {
  return createClient(
    required('SUPABASE_URL'),
    required('SUPABASE_SERVICE_ROLE_KEY'),
    clientOptions,
  )
}
