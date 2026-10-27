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

## Optional Provider Smoke Tests

```sh
npm run test:providers
```

This separate, opt-in command reads `.env.local` using the Next.js development
environment loader and makes four public catalog searches against AniList/TMDB.
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
