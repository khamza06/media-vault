# Localization — Russian Phase 1 (2026-10-29)

## Preferences and data safety

Interface language (`en` / `ru`) is independent of preferred metadata language
(`en` / `ru` / `original`). Existing browsers default to English metadata.
Settings exposes both choices; login exposes the interface-only switch.

Preferences use independent same-site browser cookies and best-effort localStorage.
`/api/locale` validates either/both fields, changes only specified cookies and
replies `private, no-store`. They are browser-specific, not synchronized across
devices, not account/profile fields, and not included in backups or public profile
projections. No database migration is required.

Localization never rewrites saved titles, notes, ratings, status, progress, dates,
covers, lists or provider IDs. Saved library cards keep their saved title.
Do not pass user titles, notes, list names/descriptions or provider prose through
the interface translator. Public sharing and the notes-free `public_items`
projection retain their existing access boundaries. No RLS/schema/auth changes.

## UI implementation

- `lib/i18n.ts` retains the existing named-key dictionaries.
- `lib/ui-messages.ts` adds typed gettext-style English source message IDs with
  Russian translations. `ui()` formats explicit messages; `translateMessage()`
  handles known application feedback/labels at presentation boundaries.
- `translateError()` supplies a localized fallback for unknown upstream errors.
  Canonical API/action error strings can remain English; the UI translates them.
- Types/statuses, dates, numbers, progress units and count nouns are display-only.
  Form values, URL filters, import payloads and exported data stay canonical.
- Coverage includes Library, Discover, details/editing, auth/recovery, lists,
  import, backup, Stats, Summary, Settings, public profiles/lists, loading/error
  states, notifications and accessibility labels.
- Native file inputs retain keyboard/upload behavior with localized visible
  controls. Controlled selects render known labels before hydration.
- The static offline shell reads only the UI preference through its small cached
  script. Shell v4 still excludes authenticated HTML/RSC, private images and
  arbitrary runtime assets. It contains no account state or network calls.
- Language changes retain unsaved note drafts, abort stale metadata requests and
  ignore late responses. They must not remount forms to discard private drafts.

## TMDB metadata

Preference is passed through header search, Discover, title suggestions, Quick
Import, exact TMDB/IMDb lookup, previews and owned-item provider details.
AniList/Shikimori usage is not expanded. No paid provider or machine translation.

Russian uses `ru-RU`; English uses `en-US`. Non-English detail requests append
TMDB translations to the same request. Title and synopsis fall back independently:
empty localized fields never erase an available English synopsis. Original prefers
original title/name and the original-language synopsis, then English when absent.
Movie and TV ID namespaces remain separate.

Mixed-language search cannot request each result's original language in one call:
Original search shows original titles with an available search synopsis; preview
resolves an original-language synopsis where TMDB provides it. Russian search
makes at most one English fallback search per query/page when synopses are missing.
It joins by TMDB ID only, never title. A result absent from that English page may
need preview/details for its synopsis. There is no detail request per search card.

Localized display genres are separate from canonical candidate genres used by
existing save/import rules. Provider details return requested-language genres.
Provider source links and attribution remain present.

Public metadata cache tags distinguish provider/type/ID/language. Existing TTLs
remain one hour for details and six hours for taxonomy. Public requests contain no
account cookies, user IDs or notes. Owned-item endpoints still authenticate and
filter by owner on every request; responses remain `private, no-store`.

## Verification and limits

Regression tests cover preference isolation, blocked storage/retry, unsaved drafts,
late-request cancellation, public title preservation/notes absence, field fallback,
original text, cache namespaces and canonical IDs. The JSX coverage guard rejects
hardcoded human-facing copy apart from explicit brands, paths and technical examples.
It does not prove every third-party diagnostic or metadata field has Russian text.

`e2e/localization.spec.ts` exercises real application routes without account writes:
switch/reload/persistence, mobile public errors/recovery, and static offline UI.
A temporary localhost fixture additionally exercises nine real components in EN/RU
at 1440/320px (36 combinations), including selects/file inputs and public cards with
a synthetic private note. Remove the fixture and its temporary test before release.
These component fixtures do not simulate an authenticated production session.

The opt-in `tests/providers/tmdb-localization.test.ts` performs five real public
TMDB checks: Russian Inception/Breaking Bad, Hukkle English fallback, Parasite
original Korean title/synopsis, and Russian search with an English interface.
It makes no AniList/Shikimori requests or database writes.

Books/anime/manga/manhwa/manhua metadata retain their existing provider behavior.
Translation coverage depends on TMDB. Browser/OS-owned dialogs/date pickers and
authentication email templates are outside application UI dictionaries.
No live production RLS/account-data integrity test is implied by mocked tests or
synthetic DOM checks. This phase does not create or mutate production user data.

## Release

Run unit tests, TypeScript, ESLint, browser checks and production build before push.
The established production branch is `main`; GitHub's Vercel commit status records
the associated deployment. Verify that status and production UI/cookie behavior
before reporting the release live. Connector team access is independent of Git
integration and can be unavailable even when Git-based deployments work.

Rollback is application-only: revert the release commit or restore the preceding
deployment. No migration/data rollback is needed. Old versions safely ignore the
new metadata preference cookie.
