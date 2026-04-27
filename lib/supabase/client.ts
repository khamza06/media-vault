import 'client-only'

import { createClient } from '@supabase/supabase-js'

import { supabaseAnonKey, supabaseUrl } from './config'

export const supabaseBrowser = createClient(supabaseUrl, supabaseAnonKey)
