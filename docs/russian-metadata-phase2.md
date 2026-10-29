# Russian anime-family metadata — Phase 2 permissions gate

Reviewed 2026-10-29 against repository baseline `56101d9` and the primary sources
below. This is an engineering release decision based on available evidence, not
a legal opinion or a claim that all factual catalog information is copyrighted.

## Decision and shipped scope

**No additional Russian anime, manga, manhwa or manhua enrichment is enabled.**
There is a material permissions blocker. No new adapter, translated-prose cache,
automatic metadata rewrite, migration, RLS change or `public_items` change ships.
The user explicitly required withholding affected integrations if terms remain
unclear. No environment flag silently overrides this decision.

Independent changes:

- Settings explains the actual limitation when Russian metadata is selected, in
  both interface languages. Movies/TV retain Phase 1's TMDB language behavior.
- Catalog ownership recognition no longer treats a same-title item from another
  provider as an exact owned work. Previously this could hide the Add action and
  link a result to a different work. Same-provider stable identities still find
  renamed works; manual entries retain the established title fallback. This does
  not create a new cross-catalog deduplication service or merge existing records.
- Regression tests preserve existing provider/native alternatives and canonical
  identities, prohibit unverified numeric/title bridges, and exercise missing
  translations/IDs, upstream failure and language changes using mocked transport.

Existing integrations are preserved, **not certified compliant** by this release.
The AniList restriction below also affects existing functionality and needs a
separate permission or provider-replacement decision. Disabling every existing
integration would change working tracking/import flows beyond this phase.

## Provider findings and field-level permissions

| Provider | Tracker compatibility / evidence | New RU retrieval, display, cache, persistent storage |
| --- | --- | --- |
| AniList | Official terms explicitly exclude competing/non-complementary anime/manga trackers, including media and user data. Media Vault has those tracking features; no project-specific exception was found in repository evidence. | Not approved for this phase. This applies to titles, aliases/IDs and descriptions as API usage, not only copied prose. No new requests or expanded cache. |
| Shikimori | Public API documents third-party clients; its general terms discuss third-party materials and do not establish a clear blanket outside-republication/storage grant for descriptions/artwork. Tracker exclusion like AniList's was not established. | Permission remains unverified separately for Russian titles, descriptions, alternate titles and images. Do not assume `description_source` transfers third-party rights. No new integration or retention policy is authorized. |
| Kitsu (anime platform) | Official OpenAPI documents client functionality and links terms. Terms redirect to `kitsu.app`; an ordinary browser reached Cloudflare verification. No bypass was attempted. No tracker prohibition was verified, and compatibility cannot be conclusively cleared. | OpenAPI advertises Apache 2.0 and client code is Apache-licensed. Neither establishes blanket rights to all catalog prose/artwork. Current data reuse, attribution and retention terms remain unverified; no new RU enrichment. |
| MAL official / Jikan | MAL's general terms restrict use of company/licensor content outside express permission. The API configuration page required login, so the applicable API agreement/client authorization could not be verified. Jikan identifies itself as an unofficial MAL scraper and tells clients to respect MAL terms. | A public Jikan endpoint and its software's MIT license do not grant MAL content rights. No verified new RU title/prose grant, storage period or attribution permission. No new MAL/Jikan enrichment. |

An absent grant in reviewed documents is **not** proof that no permission could
exist. Obtain the applicable agreement or written confirmation for this app and
each operation before connection. A permissive client/software license is not a
complete catalog-data license. Do not substitute another provider to evade the
same underlying content restriction.

### Primary sources and operational requirements

- [AniList terms](https://docs.anilist.co/guide/terms-of-use): tracker restriction
  covers media data too. Educational leniency refers to the mass-collection rule;
  it is not a blanket exception to the tracker restriction. The small-commercial
  revenue allowance likewise does not override that restriction. Retrieved HTTP
  200 through ordinary Node HTTPS; the search crawler received 403.
- [AniList rate limits](https://docs.anilist.co/guide/rate-limiting): documented
  normal 90 requests/minute and degraded 30/minute at review. A usable rate quota
  is not a permission grant.
- [Shikimori API documentation](https://shikimori.io/api/doc): HTTP 200; documents
  5 requests/second, 90/minute and a User-Agent containing the OAuth application's
  name, not a mimicked browser. A matching registered Media Vault application was
  not established. Existing `MediaVault/1.0` headers alone do not prove registration.
  [General terms](https://shikimori.io/terms) were readable (page labels its revision
  2012-10-29); [rights-holder information](https://shikimori.io/for_right_holders)
  is not itself a content-reuse license. No reliable data retention/attribution
  grant was established; don't invent a TTL or claim attribution cures this.
- [Kitsu official OpenAPI](https://raw.githubusercontent.com/hummingbird-me/api-docs/openapi3/api/kitsu.yml)
  links [terms](https://kitsu.io/terms) and identifies Apache 2.0. The
  [official documentation repository](https://github.com/hummingbird-me/api-docs)
  and [client license](https://github.com/hummingbird-me/kitsu-web/blob/react/LICENSE)
  concern the anime service, not CGWire's unrelated VFX product. Current rate,
  caching and attribution requirements could not be verified.
- [MAL terms](https://myanimelist.net/about/terms_of_use), particularly sections
  8–9, were HTTP 200 over ordinary HTTPS. Do not characterize their excessive/
  malicious automation clause as a blanket ban on every API client. The specific
  [API agreement/configuration](https://myanimelist.net/apiconfig) still requires
  verification under an authorized client account; no credentials were obtained.
- [Jikan README/disclaimer](https://github.com/jikan-me/jikan-rest/blob/master/README.MD)
  and [official API specification](https://raw.githubusercontent.com/jikan-me/jikan-rest/master/storage/api-docs/api-docs.json)
  document unofficial scraping, 3 requests/second and 60/minute. Jikan's own
  24-hour upstream response cache is an operational fact, **not** a downstream
  storage license or required application TTL. MAL can independently rate-limit
  Jikan. No new live catalog probes were made against these sources in this phase.

## Identity and presentation contract for a permitted future integration

1. Keep the saved canonical identity: provider + anime/manga namespace + ID.
   Manga, manhwa and manhua classification never makes provider IDs interchangeable.
2. Reuse an explicit provider cross-reference, such as AniList's returned `idMal`,
   only after verifying the requested AniList identity and media namespace. A null
   MAL ID stays unresolved; never derive MAL ID from an AniList number or title.
3. A future Shikimori adapter must verify its returned `myanimelist_id` against that
   bridge and its anime/manga kind. Shikimori's own numeric ID is not proof of a
   MAL mapping. Kitsu would require its own verified mapping relationship. No such
   new adapter is implemented in this release.
4. Enrich only the display model. Russian title and description fall back
   independently to nonempty English/native data. Keep originals and provenance;
   a missing Russian synopsis must not erase a valid English one. Wrong, ambiguous
   or missing bridges and provider failures leave the baseline unchanged.
5. Never update notes, ratings, progress, dates, covers, user titles or external IDs
   merely because display language changes. Public metadata requests contain no
   private user data. A borrowed synopsis must never become personal notes.
6. Use only the fields/operations explicitly permitted. Agree allowed duration,
   deletion/refresh rules, redistribution on public pages, attribution/source links,
   artwork and third-party-description treatment before choosing cache behavior.
   Implement bounded timeouts, shared rate limits and stale-response cancellation
   within those permissions. Do not mass-download a catalog for a coverage survey.

## Coverage and verification limits

**New production Russian anime-family enrichment coverage: 0 enabled categories
out of 4.** This measures feature enablement, not availability of Russian data.
No fresh catalog HTTP sample was collected in this phase because permissions
were not cleared. This report does not repeat an earlier feasibility audit's
percentages as independently re-measured evidence or claim universal coverage.

Local sanitized fixtures exercise popular and less mainstream inputs in every
category; IDs below are test inputs, not a fresh verification of provider mappings:

| Category | Representative works | AniList / MAL fixture IDs |
| --- | --- | --- |
| Anime | Naruto; Angel's Egg | 20 / 20; 885 / 885 |
| Manga | One Piece; Spirit Circle | 30013 / 13; 68071 / 38071 |
| Manhwa | Solo Leveling; Annarasumanara | 105398 / 121496; 60079 / 30079 |
| Manhua | Soul Land; Zi Bu Yu | 85446 / 72303; 50988 / 20988 |

Additional synthetic cases: Tales of Demons and Gods with no MAL mapping,
same-title/wrong-MAL ambiguity, English/native title alternatives, empty synopsis,
503 failures, all three metadata preferences, renamed owned items and unrelated
providers with equal numbers/titles. No provider prose is copied into fixtures.
All HTTP in these tests is mocked. They prove application boundaries, not upstream
coverage or licensing. Existing live-provider suites are opt-in and are not run
against blocked providers to make this report appear complete.

No production accounts, private records or schema are read or changed. Browser
smoke tests use unauthenticated routes and preference cookies. Settings component
tests cover the actual control in both languages, but do not establish an
authenticated production session or live Shikimori mapping.

## Unblocking and rollout

1. Obtain app-specific AniList tracker permission or choose a permitted canonical
   catalog strategy. Clarify existing usage too; this is a material pre-existing
   product dependency, not just a missing translation.
2. For Shikimori, confirm registered-client access and rights for each title/prose/
   image field, third-party source text, display on private/public pages and exact
   transient/persistent cache/storage allowances. Confirm required attribution.
3. Verify Kitsu's current service terms without bypassing protection and MAL's
   authorized API agreement if either remains a candidate. Do not send provider
   messages or accept agreements on the user's behalf as part of this review.
4. Once cleared, implement one exact-MAL-bridge, read-only display adapter first.
   Add permitted field-level fallbacks and language-aware caches, then run the
   above samples live within the agreed quota. Report Russian title and description
   coverage separately; count unresolved bridges separately from absent translations.
5. Release only after identity/privacy/failure tests and a limited production
   verification. Roll back application code if needed; no existing records need
   migration. This release itself needs no data rollback.

## Release validation

- `npm test`: 82 files, 702 tests passed (26 tests added relative to Phase 1).
- `npx tsc --noEmit --incremental false`: passed.
- `npm run lint`: passed without warnings after the final test cleanup.
- `npm run build`: production build passed.
- `MEDIA_VAULT_E2E_URL=http://localhost:3100 npx playwright test e2e/localization.spec.ts`:
  all four scenarios passed against the production build. Covers locale cookie
  independence/reload, EN/RU controls, 320px public/recovery states, offline shell
  and absence of the earlier temporary QA route. Does not log into a real account.

Production deployment is tied to the release commit's Vercel GitHub status.
Post-release production smoke results and the commit hash are reported in the
conversation; no live provider coverage is implied by a successful deployment.
