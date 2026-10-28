# Public Provider Cache

Only external public metadata is cached, not private vault data or search drafts.
The existing owned-item provider endpoint still authenticates and reads the
current owner's item on every request, then replies with `private, no-store`.
Its Supabase reads, account IDs, notes, status and progress never enter this cache.

## Scope

- AniList on-demand About details, including the relation graph: one-hour
  revalidation. Tags distinguish AniList IDs from MAL cross-IDs and media types.
- TMDB on-demand About details: one-hour revalidation; movie and TV namespaces
  remain separate.
- Public TMDB genre taxonomy: six-hour revalidation.
- Title search requests remain `no-store`. Import, ID preview and explicit
  metadata-refresh detail requests also retain their uncached behavior.

The implementation uses Next's documented fetch Data Cache, with finite TTLs
and tags. No module-memory cache, new SDK dependency, Cache Components opt-in,
or database change is required. Cache identity includes the provider request
URL/method/headers/body; tags contain public provider/type/ID only, not credentials
or user IDs. The current TMDB details language remains English.

Next only stores HTTP 200 responses, but GraphQL may return errors with that
status. Null/error/mismatched/malformed AniList detail payloads explicitly expire
their tag with `revalidateTag(tag, { expire: 0 })`. Invalid TMDB payloads do the
same. An ordinary failed/empty response is not intentionally retained for an hour.
Nominal TTLs are not a real-time guarantee: framework revalidation may retain
last-valid data while an upstream provider is unavailable. Refresh metadata still
uses the uncached write-enrichment path and does not rely on this panel cache.

## Verification

Unit tests check namespace separation, finite TTLs, no auth headers in public
requests, uncached search/refresh, HTTP-200 errors, malformed JSON and explicit
expiration. Existing endpoint tests still require auth and owner scope before
provider access. Eight opt-in live provider searches/details passed.

A removed localhost-only QA route used a disposable mock provider and real Next
Data Cache. Two independent route requests produced one upstream valid request.
A synthetic HTTP-200 GraphQL error expired immediately, followed by one successful
retry and then a cache hit. Distinct response request IDs excluded accidental
route-response caching. No login, Supabase write or private data was involved.
