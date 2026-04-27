import { createClient } from '@supabase/supabase-js'

import { supabaseAnonKey, supabaseUrl } from './config'

export const supabaseBrowserClient = createClient(supabaseUrl, supabaseAnonKey)
