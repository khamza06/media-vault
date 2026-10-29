import 'server-only'
import { revalidateTag } from 'next/cache'

type PublicProvider = 'anilist' | 'anilist-mal' | 'tmdb'

export function publicProviderCacheTag(provider: PublicProvider, type: string, id: number | 'genres', language = 'en') {
  return `mv-provider:v1:${provider}:${type}:${id}${language === 'en' || language === 'en-US' ? '' : `:${language}`}`
}

export function publicProviderCacheOptions(provider: PublicProvider, type: string, id: number | 'genres', language = 'en') {
  return { cache: 'force-cache' as const, next: { revalidate: id === 'genres' ? 21600 : 3600, tags: [publicProviderCacheTag(provider, type, id, language)] } }
}

export function discardInvalidProviderCache(provider: PublicProvider, type: string, id: number | 'genres', language = 'en') {
  try {
    // GraphQL can return errors with HTTP 200; do not leave those cached for an hour.
    revalidateTag(publicProviderCacheTag(provider, type, id, language), { expire: 0 })
  } catch {
    // Standalone provider probes have no Next cache context. They still return a safe failure.
  }
}
