import { describe, expect, it } from 'vitest'
import { readSupabaseConfig } from './config'
import { getSupabaseClient } from './supabaseClient'

describe('Supabase configuration', () => {
  it('runs without a backend when the variables are missing or empty', () => {
    expect(readSupabaseConfig({})).toBeNull()
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: ' ', VITE_SUPABASE_ANON_KEY: '' })).toBeNull()
    expect(getSupabaseClient(null)).toBeNull()
  })

  it('reads the project URL and publishable key', () => {
    expect(
      readSupabaseConfig({
        VITE_SUPABASE_URL: 'https://example.supabase.co/',
        VITE_SUPABASE_ANON_KEY: 'public-anon-key',
      }),
    ).toEqual({ url: 'https://example.supabase.co', anonKey: 'public-anon-key' })
  })

  it('rejects an invalid or insecure URL', () => {
    expect(() =>
      readSupabaseConfig({ VITE_SUPABASE_URL: 'not a url', VITE_SUPABASE_ANON_KEY: 'key' }),
    ).toThrow(/valid URL/)
    expect(() =>
      readSupabaseConfig({ VITE_SUPABASE_URL: 'http://example.com', VITE_SUPABASE_ANON_KEY: 'k' }),
    ).toThrow(/https/)
  })

  it('creates the client lazily from the configuration', async () => {
    const client = await getSupabaseClient({
      url: 'https://example.supabase.co',
      anonKey: 'public-anon-key',
    })
    expect(client?.auth).toBeDefined()
  })
})
