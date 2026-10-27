# Implementation Progress

This records completed increments, not a claim that the entire roadmap is done.

## Stage 0: Baseline and Auth Checks

- Added isolated regression tests and a CI test step (Node.js 24).
- Updated the CI production domain to `https://media-vault.app`.
- Preserved password whitespace instead of silently changing credentials.
- Initialized the Supabase Auth session before password updates and sign-out.
- Added local-only auth return paths and validated email OTP types.
- Released auth form loading states on transport failures; disabled mode changes
  during pending requests and made feedback accessible.
- Documented required token-hash email templates for the server-cookie flow.

Verification: automated tests, lint and production build are required for each
commit. Auth actions use mocked providers; no real signup emails, logins or vault
writes have been performed. The user requested automated checks only for now.
Live confirmation/recovery and two-account RLS checks remain unverified.

## Next Increments

1. Expand catalog search and add a dedicated Discover route.
2. Continue with the card-density, detail and collection improvements.

Later roadmap stages (density, detail-page polish, lists, saved views, backup v2,
activity history, calendar and seasons/repeats) are not implemented by this entry.
No schema migration is included in the baseline increment.

## Stage 0: Dependency Maintenance

Updated the runtime and monitoring SDK within their current major versions,
reviewed the provider advisories and patched compatible transitive dependencies.
See [dependency maintenance](dependency-maintenance.md) for the narrow typography
override and the intentionally unchanged lint preset. No application schema or
product behavior was changed by this maintenance increment.

## Stage 1: AniList Imports and Metadata Identity

- AniList list scores explicitly request `POINT_10_DECIMAL`; personal ratings are
  rounded to the existing integer 1-10 model. Community scores always convert
  from 0-100, separately from already-normalized preview values.
- Source notes are preserved exactly, and complete valid start/finish dates are
  saved in the existing date fields. Incomplete dates and repeat counts are not
  imported; the preview states this limitation.
- Fixed the second-pass normalization of `Re-Watching` during selected import.
- Kept MAL tags separate, generic CSV behavior unchanged, and duplicate skipping
  by source ID and normalized title/type. Added guest and malformed-row tests.
- Metadata refresh prefers stored AniList/TMDB IDs. A provider failure does not
  trigger a replacement by a loosely similar title. Without an ID, ambiguous or
  non-exact title matches are skipped. Existing MAL cover enrichment keeps its
  prior fallback behavior.
- Added timeouts to provider detail lookups and feedback for refresh transport
  failures. Refresh writes remain limited to metadata, with owner scoping.

Verification: 105 isolated regression tests cover these paths, including
source separation and protected user fields. AniList schema fields were checked
with a read-only public introspection request. No real import/refresh writes or
logged-in UI checks were performed; those remain manual test-account checks.
Read-only live provider probes also returned HTTP 200 and matching IDs for
AniList anime 20, TMDB movie 27205 and TMDB series 1396. Keys were not logged.
