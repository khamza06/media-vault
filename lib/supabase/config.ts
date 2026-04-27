const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
}

if (!supabaseAnonKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

const verifiedSupabaseUrl: string = supabaseUrl
const verifiedSupabaseAnonKey: string = supabaseAnonKey

export {
  verifiedSupabaseAnonKey as supabaseAnonKey,
  supabaseServiceRoleKey,
  verifiedSupabaseUrl as supabaseUrl,
}
