# P1 stability and database remediation — 2026-10-28

Base: `7ae5006` (deployed P0 notes protection).

## Changes

- Production lacked `items.last_progress_at`. Applied additive reconciliation
  migration `20261028132404_reconcile_item_progress_schema.sql`: nullable date,
  owner/date index, and the same public projection now reading the real column.
  No old timestamps fabricated, row backfills, counter conversions, or policy
  changes. Aggregate row counts and fingerprints for all four application
  tables matched before/after the migration, excluding only the new column.
- March/April SQL fragments were never recorded in the production ledger and
  were not a complete baseline. Preserved them unchanged under `supabase/legacy`
  so automated migrations cannot accidentally replay permissive reads or data
  rewrites. Active filenames match the actual remote ledger. Added guarded,
  metadata-only fresh-project bootstrap and operator instructions. No fake
  historical ledger entries. Removed stale in-app instructions to replay SQL.
- Item-detail fallback removes only the explicitly missing optional field. A
  missing timestamp no longer removes provider IDs. Every retry stays scoped
  to the current owner; missing ownership fails closed.
- Catalog block terms use Unicode word boundaries instead of substrings (`ero`
  inside `Hero`/`Zero`). Shared two-character minimum across API, add dialog,
  header search, Discover and English/Russian help text admits `Re`. Existing
  adult-provider filtering and standalone-term checks remain.
- Cover bytes upload directly to Supabase with a server-created, owner-path
  signed token. Metadata-only Server Action validates the shared 5 MiB/MIME
  rules; actual bucket limit remains 5,242,880 bytes. This avoids both the
  default 1 MB Next Server Action body limit and Vercel's function body limit.
  No broad upload grants or service-role credentials. MIME determines extension.
- Restore, AniList, MAL and CSV imports share identity-first duplicate tracking;
  matching canonical provider/type/ID is skipped even after a local rename.
  Distinct identified works with equal titles survive. Title fallback remains
  for unidentified/manual records. Import lookups paginate through the complete
  owner library, avoiding the Data API row cap. List restore maps distinct work
  IDs and rejects conflicting known identities across providers.
- Next 16 Proxy refreshes sessions before rendering, forwards fresh cookies to
  the current request and persists **both** rotated HttpOnly cookies to the
  browser. Authenticated/refreshed responses are private/no-store. Server
  Components no longer rotate tokens they cannot persist. Temporary auth
  outages do not delete recoverable browser credentials. DAL still verifies
  the user; Proxy is session maintenance, not a replacement for authorization.

## Verification

- Automated suite: 461 tests / 58 files, including regressions for each code
  fix, owner-filtered compatibility retries, restored list mappings, signed
  upload boundaries and request/response refresh cookie persistence.
- TypeScript (`--noEmit --incremental false`), ESLint, production build and
  `git diff --check` passed.
- After schema migration, 59 real-session checks passed using two disposable
  accounts plus anonymous clients, including note privacy, owner writes,
  public/private profiles/lists, no-slug lists, inconsistent ownership, visibility
  revocation, and four production public page HTML/RSC responses.
- Production P1 verification passed 27 additional checks on deployed `ae7880f`:
  expired/invalid access recovery using a real refresh token; current-render
  authentication; both HttpOnly/Secure cookies; subsequent authenticated export;
  identity-preserving restore/import and repeat-import skips through actual
  Server Actions; real public progress timestamps; private notes isolation;
  actual AniList results for `My Hero Academia` and `Re`; signed owner upload of
  exactly 5 MiB; app and Storage rejection of oversize files; cross-owner upload
  denial. These used ordinary real sessions and anonymous clients, not service
  role simulation. The opt-in scripts require `MEDIA_VAULT_RLS_VERIFY=1` and an
  in-memory `MEDIA_VAULT_RLS_FIXTURE` JSON containing only synthetic credentials
  and UUIDs. Never run against friends' accounts or print credentials/Flight.
  `verify-production-rls.mjs` runs first, then `verify-production-p1.mjs`; the
  latter removes the exact deliberately inconsistent synthetic membership
  before testing coherent backup export. Account provisioning/deletion is an
  operator step, scoped to exact generated UUIDs and invalid-domain emails.
- Production `media-vault.app` became READY at deployment
  `dpl_FkskQCiq7eKRPZ5AGHjPdA4GF49Y` for `ae7880f414dfaebdc7243d398da90bd46e190fbd`.
  `/api/auth-health` returned HTTP 200 and the expected production project.
- Cleanup verified zero remaining synthetic accounts, auth identities, items,
  lists, memberships, profiles or Storage objects. Original row counts **and
  data fingerprints** for items/lists/memberships/profiles also matched after
  cleanup, establishing that all original records remained unchanged.
- Vercel runtime error-log inspection was unavailable: MCP returned 403 and
  the CLI had no credentials (device login cancelled). Do not interpret this
  as an empty error log. Deployment readiness and live checks were verified.

## Limits and rollback

- Production bootstrap was reconstructed from schema metadata and reviewed;
  isolated fresh-project provisioning is not integration-tested because this
  workstation has no PostgreSQL/Docker runtime. Existing production schema and
  the actual forward migration were verified directly. This is a new-project
  provisioning limitation, not unresolved production schema drift.
- The intentional definer `public_items` advisor exception remains: fixed
  projection, explicit public-profile predicate, security barrier, SELECT-only.
  Existing mutable trigger search path and disabled leaked-password-protection
  advisor warnings are outside these P1 changes.
- Retain the additive column/index on application rollback, particularly once
  timestamps have been written. Never replay legacy SQL, restore public base
  item reads, expose notes in `public_items`, or drop timestamps to roll back.
- Covers are intentionally public by URL, unchanged from the existing sharing
  model. No user media, notes, list membership or visibility was migrated or
  rewritten. No historical disclosure assessment is implied by these tests.
