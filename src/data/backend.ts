import type { Backend } from './auth'
import { supabaseConfig, type SupabaseConfig } from './config'
import { getSupabaseClient } from './supabaseClient'

// Returns null when no Supabase project is configured, so the app runs in demo mode only.
// The Supabase code is split out of the first load and fetched only when a project exists.
export function loadBackend(
  config: SupabaseConfig | null = supabaseConfig,
): Promise<Backend> | null {
  const client = getSupabaseClient(config)
  if (!client) return null
  return Promise.all([client, import('./supabaseAuth'), import('./supabaseRepository')]).then(
    ([supabase, { createSupabaseAuth }, { createSupabaseRepository }]) => ({
      auth: createSupabaseAuth(supabase),
      createRepository: (user) => createSupabaseRepository(supabase, user),
    }),
  )
}
