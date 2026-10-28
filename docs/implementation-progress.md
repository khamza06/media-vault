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

1. Continue detail-page improvements; Continue and account-scoped view preferences are complete.
2. Continue detail-page and collection improvements, saved views and backup v2.
3. Keep the schema-heavy activity/calendar/seasons stages separate and reviewed.

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

## Stages 2-3: Catalog Discovery and Navigation Foundation

- Added a private `/discover` page for external catalogs; retained `/share/me`
  as Advanced Library Search. Updated header, mobile Discover tab and onboarding
  links. Summary and all existing routes remain accessible.
- Kept five quick header suggestions; added View all results and a 400 ms debounce.
- Added explicit full-search paging (up to 20) for existing providers, with source
  selection for AniList/Jikan/Kitsu/Shikimori. Sources are chosen, not aggregated.
- Kept quick-import resolver defaults small. TMDB details load only on preview,
  avoiding a detail request for every result on a 20-card page.
- Added a keyboard-accessible, responsive native preview dialog, existing Add New
  flow integration, owned-item recognition and the existing Add to list action
  for recognized saved items. Catalog/recommendation descriptions no longer
  become notes; the older URL-import resolver is unchanged in this increment.
- URL query/type/source survive navigation. Source/query changes reset paging;
  stale responses cannot replace newer results. Real provider errors are shown.
- Added component tests for typing without blur, response races, back/source
  paging and Strict Mode dialog lifecycle, plus optional live provider checks.

Verification: 137 offline tests and four opt-in live catalog searches passed.
Browser fixture checks at 1440/1280/768/390/320 px confirmed consistent columns,
no horizontal overflow, 20-to-40 pagination, type/source/back changes, race
handling, preview Escape/focus return and the existing add form opening.
The temporary route was removed before final build. No real item/list writes,
authenticated UI tests, confirmation emails or two-account RLS tests were run.

Remaining from the broader search/navigation plan: provider cache tuning,
cross-provider alias aggregation and a full EN/RU navigation/copy pass. A new
desktop sidebar, MangaDex and schema-heavy features were not added here.

See [catalog search](catalog-search.md) and [testing](testing.md) for repeatable
commands and verification boundaries. No SQL migration or production data change
was needed for these increments.

## Stage 4A: Continue Shelf

- Added a compact Continue rail above the Library's media-family shelves, with
  up to six Watching, Reading or Re-Watching items from the current filtered view.
- Sorts by the saved progress-update date, falling back to activity/creation dates
  when unavailable. Invalid dates are ignored; ties use item ID for stable order.
  No consumption history or percentage is invented for unknown totals.
- Reuses the existing owner card, progress action, busy state, list picker and
  filter-preserving detail return URL. Items stay on their ordinary shelves too.
- Hides the extra rail in bulk-selection mode and when no matching active items
  exist. No new fetching, persistence, provider calls or schema changes.

Verification: 146 isolated tests, lint and the production build passed, including nine new selection
and component tests. These cover filtering, dates, unknown totals, exact notes
preservation, existing action props, parent progress/busy updates and bulk-mode
visibility. No authenticated browser session or live vault writes were used;
visual validation with a signed-in account remains a manual check.

## Stage 4B: Account-Scoped Library Views

- Added Comfortable / Compact / Table controls shared by home and shelf pages.
  Table shows all filtered home items, with responsive rows instead of a wide
  horizontally scrolling table. Compact cards hide secondary genre badges.
- Reuses the existing card actions, owner-only list picker, progress busy state,
  URL filters and return links. Bulk selection clears when switching views.
- Stores only the selected view in browser localStorage, under a versioned key
  scoped to the signed-in user ID already available in the root layout. No extra
  auth request, database preference, user notes or secrets are stored there.
- Handles blocked storage/quota errors in memory, validates stored data and
  synchronizes other tabs. Guests do not inherit another account's preference.
- Added a small progress indicator only when the saved total is known; display
  clamping does not modify saved progress. Public card grids are unchanged.

Verification: 157 tests, lint and the production build passed.
Automated component/selection tests cover storage/account isolation, failures,
card actions, row selection and chapter units. Synthetic browser checks at
320/390/768/1280/1440/1920 px found no page overflow in all three modes; verified
15-row selection, URL filtering and restoring Table after reload/hydration.
No signed-in browser session or live item writes were used. The temporary QA
route was removed before the production build.

Next checkpoint: detail-page provider metadata and draft-safe section polish.

## Stage 5A: Catalog Identity and Exact Notes

- Found and fixed the gap between catalog selection and Add New saving: selected
  provider IDs now reach the existing `external_source` / `external_id` columns.
  Identity is validated against the chosen media type; title/type edits clear it.
- Manual additions stay untagged. Jikan uses `jikan`, not the `myanimelist` XML
  import cleanup tag. No old items are retagged and no cleanup runs automatically.
- Catalog adds check for an existing owned source/ID/type and return that item
  without overwriting it. This prevents sequential duplicate adds; without a new
  unique database index it does not claim atomic cross-tab race protection.
- Detail queries now read source identity, retaining older-schema compatibility.
  No new item columns, migrations or RLS changes were made.
- Full create/edit normalization no longer trims Markdown notes. Malformed form
  payloads return validation errors. Add New keeps its draft after transport
  errors, prevents duplicate submits and now actually closes after a successful
  save (the old close handler saw a stale submitting state).

Verification: 189 isolated tests, lint and production build passed. New mocked
checks cover provider/type validation, owner-scoped reads/inserts, duplicate
lookup failures, manual/MAL separation, schema fallbacks, exact notes and Add New
success/error behavior. No live account, signup email or database write was used.

## Stage 5B: On-Demand Provider Details

- Added a collapsible About this title section to private item details. It loads
  synopsis, provider title, genres, year, format, duration when provided, and a
  canonical source link only when opened. Short/long descriptions remain readable.
- Uses existing AniList/TMDB detail clients and exact saved IDs; MAL/Jikan IDs
  can resolve through AniList's MAL mapping. Kitsu, OpenLibrary and Shikimori
  details are not guessed across unrelated ID namespaces.
- Added an authenticated owner-scoped endpoint with private/no-store responses,
  minimal item selection and safe missing/error/retry states. No metadata writes
  occur, and public profile/list components remain unchanged.
- Jikan metadata refresh now also uses its saved MAL ID without changing the
  source cleanup tag. Notes previews keep the same draft while provider sections
  toggle and other personal fields save. Item editors are keyed by item ID to
  avoid carrying one item's draft into another detail page.

Verification: provider/component/API tests cover lazy loading, retry, owner scope,
missing IDs, sanitized text, exact notes and failed saves. Eight opt-in live
AniList/TMDB search/detail checks passed, without any auth or database mutation.
Lint, TypeScript and production build passed. Related-title browsing is still
deferred; no fake relation or activity history is added.

Next checkpoint: collection cover previews and safe bulk list/status/favorite actions.
