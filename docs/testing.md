# Regression checks

Use Node.js 24 (the same version as CI), then run:

```sh
npm ci
npm test
npm run lint
npm run build
```

Vitest, React Testing Library and JSDOM are development-only dependencies. Default
tests use synthetic fixtures and mock
Supabase calls, cookies and cache invalidation. They do not read an account's
vault, send emails, create accounts, or write to a live database.

Covered initially: credential handling, auth action outcomes and recovery session
setup, confirmation return-path validation, production redirect configuration,
filter URL round-tripping, progress units and exact Markdown backup preservation.

Import/metadata tests also cover AniList score scales, exact source notes,
complete/incomplete dates, repeated status normalization, duplicate skipping,
MAL/CSV source separation, stable provider IDs and metadata-only owner writes.

Discover component tests cover debounce with input focus retained, stale response
cancellation, source-switch/back pagination reset and Strict Mode dialog lifecycle.
JSDOM tests do not replace responsive layout checks in a real browser.

Continue shelf tests cover active statuses, last-progress ordering and safe date
fallbacks, the six-card limit, current Library filters, notes immutability, card
action/return URL reuse, progress/busy rerenders and hiding during bulk selection.

View preference tests cover validation, account isolation, reload/remount,
cross-tab changes and blocked storage. Card layout tests cover the same progress,
list and return-link controls in grid/rail/row modes, bulk selection and known vs
unknown totals. Browser checks use synthetic data, not an authenticated vault.

Additional suites cover reviewed bulk status/favorite updates, safe list membership
conflicts, owner-only cover previews, on-demand provider details, exact note drafts,
saved view account isolation and the non-mutating Planning picker.

Backup checks simulate more than 1000 records under a smaller API row cap, later
page failures, strict owner filters, TMDB movie/TV ID collisions, canonical provider
IDs, malformed tracking values, explicit preview selection and honest result counts.
They never restore data into a real vault. Backup v2 list/membership tests cover
private fresh lists, selected identity mapping, malformed graphs, duplicate names,
partial failures and original addition dates. Live restore/RLS remains manual.

Localized form tests render the shared Add New/full-edit controls in Russian and
English, retain canonical type/status values, and verify exact Markdown/progress
payloads, provider identity, duplicate feedback and draft recovery. Unit tests
inspect option values independently of Radix geometry; real-browser synthetic
fixtures check the actual custom dropdown and responsive layout without saving.

Library localization checks preserve every filter option value/order, query text,
clean URL keys, active-chip removal, owner-card return URLs, completion group
counts and canonical density preferences. Synthetic browser checks cover actual
Radix status selection, URL updates, clearing, table mode and long Russian copy.

## Optional Provider Smoke Tests

```sh
npm run test:providers
```

This separate, opt-in command reads `.env.local` using the Next.js development
environment loader and makes four public catalog searches and four linked-detail
lookups against AniList/TMDB.
TMDB needs a configured API key. It never signs in, sends email or writes to
Supabase. It is not part of CI: external outages/rate limits can make it fail.
Do not enable verbose request/URL logging that could reveal API keys.

Passing mocked tests does not prove email delivery, dashboard configuration or
live RLS policies. Follow [the manual checklist](final-qa-checklist.md) with a
separate test account for these checks. Do not delete real vault data during QA.

For auth checks, use the token-hash templates in [auth setup](auth-setup.md).
Test confirmed and unconfirmed accounts, expired links, sign out, reset password,
and access from a second account. Never put passwords, tokens or email-link
hashes in fixtures, screenshots, logs or committed files.
