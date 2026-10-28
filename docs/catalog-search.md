# Catalog Search

`/discover` searches external catalogs, separately from Advanced Library Search
at the existing `/share/me` URL. Both routes remain available. Header suggestions
still return at most five results and use the same Add New form.

## Full Search

- Starts after three characters and a 400 ms typing debounce.
- Returns up to 20 results per provider page, with Show more.
- Query, media type and chosen source are stored in the URL. Browser navigation
  resets the provider cursor to page one; bulk selection is not involved.
- AniList is the default anime/manga source. Jikan, Kitsu and Shikimori can be
  chosen explicitly. These are existing integrations, not new APIs or account sync.
- Movie/series use TMDB and books use Open Library.
- Only the selected source is queried in full search. Results from other sources
  are not automatically aggregated; source changes start a new result set.
- Provider failures are shown, not disguised as successful empty results.
- Preview cards reuse the existing Add New flow. Recognized owned titles show
  Already in vault and an Add to list control. Source descriptions stay separate
  from personal notes; existing draft notes are preserved.

## Provider and Data Safety

Full search has its own explicit pagination options. Small quick-import/resolver
defaults remain five results. TMDB details are fetched on preview, not for every
card in a 20-result page. AniList/Jikan/Kitsu search responses provide descriptions
when available. No provider description is saved into the user's notes by default.

Different IDs with the same title are not collapsed within full search. Existing
vault duplicate protection still uses the app's current source/title rules. No
new item columns or cross-provider identity table were introduced.

Private search/detail APIs require the current user. Public profile/list grids
are unchanged and do not gain Discover mutation controls. Search logs use query
length and provider status rather than raw queries or keys.

## Verification Scope

Default tests mock network/auth/database access. Optional provider smoke tests
make real read-only anime/manga/movie/series searches without signing in.
Alternative-provider pagination/error paths are mocked; live availability of
each alternative is not guaranteed by passing the core suite.

## Related Title Browsing

Owned anime/manga with an exact supported AniList or MAL/Jikan reference load
AniList relations when About this title is expanded. One request supplies the
description and relation graph; import and metadata-refresh queries do not fetch
the graph. No request is made per related title.

The panel shows six connections initially and at most 24 after expanding.
Adult/unknown-age nodes, unsupported types, duplicate IDs and self references are
excluded. Relation labels come from AniList, not an inferred viewing order.
Canonical AniList links open externally; Search in Discover links only populate
the existing title/type search. They do not add a title or change tracking.
Very short titles keep the provider link rather than opening an unusable search.

TMDB relations, title alias aggregation and automatic sequel tracking are not
implemented in this increment. Public vault/list pages are unchanged. Unit tests
cover normalization, safe links, graph bounds, UI disclosure and existing notes
drafts. Opt-in live provider checks include a real Naruto sequel relation.

A temporary development-only fixture exercised the actual components at
1440, 1280, 768, 390 and 320 px, including Show more, source/back changes,
type changes, cancellation, preview Escape focus restoration and opening the
existing add form. It was removed before the production build. No real save,
list mutation or authenticated database write was performed in this QA pass.
