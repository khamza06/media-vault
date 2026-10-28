import 'server-only'
import { revalidateTag } from 'next/cache'

type PublicProvider = 'anilist' | 'anilist-mal' | 'tmdb'

export function publicProviderCacheTag(provider: PublicProvider, type: string, id: number | 'genres') {
  return `mv-provider:v1:${provider}:${type}:${id}`
}

export function publicProviderCacheOptions(provider: PublicProvider, type: string, id: number | 'genres') {
  return { cache: 'force-cache' as const, next: { revalidate: id === 'genres' ? 21600 : 3600, tags: [publicProviderCacheTag(provider, type, id)] } }
}

export function discardInvalidProviderCache(provider: PublicProvider, type: string, id: number | 'genres') {
  try {
    // GraphQL can return errors with HTTP 200; do not leave those cached for an hour.
    revalidateTag(publicProviderCacheTag(provider, type, id), { expire: 0 })
  } catch {
    // Standalone provider probes have no Next cache context. They still return a safe failure.
  }
}
