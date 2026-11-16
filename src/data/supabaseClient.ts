import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseConfig, type SupabaseConfig } from './config'

let clientPromise: Promise<SupabaseClient> | null = null

// supabase-js is loaded on first use so demo mode and the first screen stay small.
export function getSupabaseClient(
  config: SupabaseConfig | null = supabaseConfig,
): Promise<SupabaseClient> | null {
  if (!config) return null
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(config.url, config.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    }),
  )
  return clientPromise
}
