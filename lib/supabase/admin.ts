import 'server-only'

import { createClient } from '@supabase/supabase-js'

import { supabaseAnonKey, supabaseServiceRoleKey, supabaseUrl } from './config'

export function createSupabaseAdminClient() {
  return createClient(supabaseUrl, supabaseServiceRoleKey ?? supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  })
}

export function hasSupabaseAdminClient() {
  return Boolean(supabaseServiceRoleKey)
}
