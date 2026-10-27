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

A temporary development-only fixture exercised the actual components at
1440, 1280, 768, 390 and 320 px, including Show more, source/back changes,
type changes, cancellation, preview Escape focus restoration and opening the
existing add form. It was removed before the production build. No real save,
list mutation or authenticated database write was performed in this QA pass.
