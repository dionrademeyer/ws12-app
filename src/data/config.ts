export interface SupabaseConfig {
  url: string
  anonKey: string
}

interface SupabaseEnv {
  VITE_SUPABASE_URL?: string
  VITE_SUPABASE_ANON_KEY?: string
}

// Returns null when the app runs without a Supabase project, for example in demo mode.
export function readSupabaseConfig(env: SupabaseEnv): SupabaseConfig | null {
  const url = env.VITE_SUPABASE_URL?.trim()
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim()
  if (!url || !anonKey) return null

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('VITE_SUPABASE_URL is not a valid URL')
  }
  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') {
    throw new Error('VITE_SUPABASE_URL must use https')
  }
  return { url: parsed.origin, anonKey }
}

export const supabaseConfig = readSupabaseConfig(import.meta.env)
