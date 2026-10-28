# Smart Quick Import: first production version

The Add New dialog accepts a public HTTP(S) URL or a title, with an optional media
type. Search is authenticated and consumes an atomic per-user allowance of 30
requests per 10 minutes. It only identifies works: nothing is inserted until the
user chooses a candidate and submits the existing Save Item form.

## Identification

1. Known AniList, MAL, Shikimori, TMDB, IMDb and Open Library URLs use exact IDs
   on fixed provider endpoints. Slugs never replace a failed exact lookup.
   MAL can use AniList's verified `idMal` cross-reference while retaining the MAL
   identity used by Jikan. Open Library work merges are followed only as validated
   `/works/OL…W` paths, at most twice. IMDb uses TMDB's external-ID lookup.
2. Other sites are read only when public and permitted by robots.txt. Streaming
   HTML parsing extracts OG/Twitter titles, JSON-LD work names/alternate names,
   type, language, author, release year and a canonical-URL hint. Canonical hints
   are never fetched or promoted to trusted provider IDs.
3. Unicode normalization preserves Japanese voicing, Korean syllables and Indic
   marks. Native titles, provider aliases and deterministic transliteration are
   searched. This is not machine translation. AniList synonyms/native/romaji,
   Shikimori Russian names, Jikan synonyms, Kitsu titles, TMDB localized/original
   names and Open Library work/author fields contribute evidence.
4. Matching uses title/alias agreement, media type, release year and author.
   Unrelated results are discarded; equal-score works remain separate, with
   certainty reduced. Confidence labels are qualitative, not probabilities.
5. A user explicitly applies a match. Only catalog fields change; personal notes,
   rating, progress, dates, favorites, valid status and selected cover files are
   retained. Provider descriptions never become private notes. Stable provider
   identity reaches the existing owner-only create action. Jikan IDs also check
   existing MAL-import identities; duplicate saves do not overwrite stored data.

## Fetch boundary and limits

- Public hostnames only; no literal IPs, credentials, token-bearing URLs,
  nonstandard ports, local suffixes, private/reserved/mapped network addresses.
- Resolve all DNS answers, reject mixed private/public results, then pin the
  socket lookup to one validated IP while retaining hostname TLS verification.
  No ambient proxy, cookies, authentication, shared agent or browser automation.
- Robots are checked before each page and after an origin change. Robots errors,
  redirects or positive crawl-delay fail closed. Page `noindex`, `nosnippet` and
  `noai` restrictions are respected. No 403/429, paywall or anti-bot bypass.
- At most two page redirects; DNS/IP is rechecked on every connection. HTTPS
  downgrades are rejected. Fetch budget is at most six page/robots requests.
- 6.5 seconds total for source-page retrieval, 4-second socket inactivity timeout,
  16 KiB headers, 64 KiB robots, 512 KiB HTML. Strict MIME and streaming byte
  limits; compressed source responses are refused. HTML scripts are not executed.
- Provider plans search one primary title, then at most one alternate/transliterated
  title if needed. No recursive crawling or search over all page text. Each
  provider uses its normal timeout; identification stops waiting after 18 seconds,
  client after 23 seconds, Vercel route budget 25 seconds.
- Request bodies are limited to 8 KiB, titles to 200 characters, URLs to 2048.
  Rate state is one private row per account, with no titles, URLs, IPs or notes.
  Auth UID is server-verified; quota calls have no caller-supplied owner ID. Missing
  quota infrastructure returns 503, never an unlimited fallback. Anonymous RPC
  access and direct private-table reads are denied.

## Database rollout / rollback

`20261028234214_add_quick_import_quota.sql` matches the production migration
version. It adds only a private RLS-enabled table and authenticated quota RPC.
Existing item/list/profile/notes policies are unchanged. A no-policy advisor INFO
for this private table is intentional: it has no direct API access. The existing
notes-free `public_items` view is not changed by this feature.

Rollback application code first, then drop only the new quota function/table as
documented in the migration. Do not replay historical privacy migrations. Deleting
disposable QA users cascades their quota state and owned records.

## Coverage and limitations

Live public-provider tests exercise English (`Naruto`), Russian (`Наруто`, movie
`Начало`), Japanese (`進撃の巨人`), Korean (`나 혼자만 레벨업`), Simplified Chinese
(`斗罗大陆`), Traditional Chinese (`鬥羅大陸`), TV (`Breaking Bad`) and books
(`Dune`). Exact AniList, MAL, TMDB, IMDb and redirected Open Library links are
tested. Actual unfamiliar-page retrieval is checked against `example.org`;
OG/JSON-LD language/type/year/author variations use controlled HTML fixtures.
Jikan was unreachable during initial live testing; exact MAL lookup succeeded
through AniList's authoritative ID cross-reference. Kitsu/Shikimori fallback
classification and provider failures are also covered by deterministic tests.

This does not cover every site or translated title. Login/paywall/robots/anti-bot,
JavaScript-only pages, unsupported aliases, legacy encodings and provider outages
can prevent identification. A title search/manual form always remains available.
No paid API, LLM dependency, automatic translation, account sync, or bulk import
was introduced. Mobile Chromium and keyboard checks do not replace physical
Safari/iOS or screen-reader testing.

Run `npm test`, `npm run test:providers`, `npx tsc --noEmit`, `npm run lint --
--max-warnings 0`, `npm run build`, and the existing disposable-account Playwright
harness. `e2e/smart-import.spec.ts` tests explicit selection, exact identities,
unchanged drafts, duplicate preservation, mobile fallback and atomic quota
isolation. Quota tests require a fresh disposable B account/window; never reset
real users' quota rows to run tests.
