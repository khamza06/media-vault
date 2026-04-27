import 'server-only'

import { createClient } from '@supabase/supabase-js'

import { supabaseAnonKey, supabaseUrl } from './config'

export function createSupabaseServerClient(accessToken?: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
  })
}
