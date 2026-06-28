import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type AuthHealthCheck = {
  authEndpointReachable: boolean | null
  authEndpointStatus: number | null
  hasAnonKey: boolean
  hasSiteUrl: boolean
  hasSupabaseUrl: boolean
  siteUrl: string | null
  supabaseHost: string | null
  supabaseUrlHasProtocol: boolean
  supabaseUrlLooksLikeSupabase: boolean
  supabaseUrlParseable: boolean
}

function normalizeOptionalEnv(value: string | undefined) {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : null
}

function parseUrl(value: string | null) {
  if (!value) {
    return null
  }

  try {
    return new URL(value)
  } catch {
    return null
  }
}

function anonKeyLooksValid(value: string | null) {
  if (!value) {
    return false
  }

  return value.startsWith('eyJ') || value.startsWith('sb_publishable_')
}

function buildAdvice(checks: AuthHealthCheck, anonKeyLooksRight: boolean) {
  const advice: string[] = []

  if (!checks.hasSupabaseUrl) {
    advice.push('Set NEXT_PUBLIC_SUPABASE_URL in Vercel Production environment variables.')
  } else if (!checks.supabaseUrlParseable || !checks.supabaseUrlHasProtocol) {
    advice.push('NEXT_PUBLIC_SUPABASE_URL must be a full URL like https://your-ref.supabase.co.')
  } else if (!checks.supabaseUrlLooksLikeSupabase) {
    advice.push('NEXT_PUBLIC_SUPABASE_URL should point to your Supabase project, not media-vault.app.')
  }

  if (!checks.hasAnonKey) {
    advice.push('Set NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel Production environment variables.')
  } else if (!anonKeyLooksRight) {
    advice.push('NEXT_PUBLIC_SUPABASE_ANON_KEY does not look like a Supabase anon/publishable key.')
  }

  if (!checks.hasSiteUrl) {
    advice.push('Set NEXT_PUBLIC_SITE_URL=https://media-vault.app in Vercel Production environment variables.')
  } else if (checks.siteUrl !== 'https://media-vault.app') {
    advice.push('NEXT_PUBLIC_SITE_URL should be https://media-vault.app for production.')
  }

  if (checks.authEndpointReachable === false) {
    advice.push('The Vercel function cannot reach Supabase Auth. Check the Supabase project status and URL.')
  }

  if (checks.authEndpointStatus === 401 || checks.authEndpointStatus === 403) {
    advice.push('Supabase Auth responded, but rejected the anon key. Re-copy the anon key from Supabase.')
  }

  return advice
}

export async function GET() {
  const supabaseUrl = normalizeOptionalEnv(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const anonKey = normalizeOptionalEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  const siteUrl = normalizeOptionalEnv(process.env.NEXT_PUBLIC_SITE_URL)
  const parsedSupabaseUrl = parseUrl(supabaseUrl)
  const anonKeyLooksRight = anonKeyLooksValid(anonKey)

  let authEndpointReachable: boolean | null = null
  let authEndpointStatus: number | null = null

  if (parsedSupabaseUrl && anonKey) {
    try {
      const settingsUrl = new URL('/auth/v1/settings', parsedSupabaseUrl)
      const response = await fetch(settingsUrl, {
        cache: 'no-store',
        headers: {
          apikey: anonKey,
          authorization: `Bearer ${anonKey}`,
        },
        signal: AbortSignal.timeout(5000),
      })

      authEndpointReachable = true
      authEndpointStatus = response.status
    } catch {
      authEndpointReachable = false
      authEndpointStatus = null
    }
  }

  const checks: AuthHealthCheck = {
    authEndpointReachable,
    authEndpointStatus,
    hasAnonKey: Boolean(anonKey),
    hasSiteUrl: Boolean(siteUrl),
    hasSupabaseUrl: Boolean(supabaseUrl),
    siteUrl,
    supabaseHost: parsedSupabaseUrl?.hostname ?? null,
    supabaseUrlHasProtocol:
      supabaseUrl?.startsWith('https://') === true || supabaseUrl?.startsWith('http://') === true,
    supabaseUrlLooksLikeSupabase: parsedSupabaseUrl?.hostname.endsWith('.supabase.co') ?? false,
    supabaseUrlParseable: Boolean(parsedSupabaseUrl),
  }
  const advice = buildAdvice(checks, anonKeyLooksRight)
  const ok =
    checks.hasSupabaseUrl &&
    checks.supabaseUrlParseable &&
    checks.supabaseUrlLooksLikeSupabase &&
    checks.hasAnonKey &&
    anonKeyLooksRight &&
    checks.authEndpointReachable === true &&
    checks.authEndpointStatus !== 401 &&
    checks.authEndpointStatus !== 403

  return NextResponse.json({
    advice,
    checks,
    ok,
  })
}
