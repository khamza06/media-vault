import { createClient } from '@supabase/supabase-js'

import { supabaseAnonKey, supabaseUrl } from './supabase/config'
export {
  createSupabaseAdminClient,
  hasSupabaseAdminClient,
} from './supabase/admin'
export { createSupabaseServerClient } from './supabase/server'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
export const supabaseClient = supabase
