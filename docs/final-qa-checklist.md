# Final QA Checklist

Use this checklist before presenting or deploying a production portfolio build.

## Auth

- Sign up with a new email.
- Confirm the email link returns to `/auth/callback` on the production domain.
- Sign in with the confirmed account.
- Try an incorrect password and confirm the error is friendly.
- Request a password reset and confirm it opens `/auth/reset-password`.
- Sign out and confirm private pages require auth.

## Library and Items

- Add a new item from the Add New flow.
- Search Discover and add an external result.
- Open an item detail page.
- Change status, rating, and progress.
- Edit Markdown notes and confirm notes render correctly.
- Confirm all writes use `progress` and preserve `notes`.
- Confirm bulk selection and Delete selected remove only owned items.
- Switch Comfortable/Compact/Table, reload, and check preference isolation between accounts.
- Save/open/remove a named filter view; confirm its URL and return navigation.
- Try Pick for me with and without Planning items under the current filters.
- Review bulk status/favorite/list changes; cancel, then test a small confirmed selection.
- Simulate a network failure on +1 and confirm rollback and a usable retry.
- Expand provider details; confirm notes drafts survive loading, retry and preview toggles.
- On an AniList-linked item, expand related titles; confirm sequel/adaptation labels, provider links and Discover search links without automatic additions.
- Search two same-title works with different provider IDs; do not mark the remake already saved.

## Imports and Covers

- Upload a MyAnimeList XML file and preview parsed items.
- Import a small selected subset.
- Import the same subset again and confirm duplicates are skipped.
- Run Fill Missing Covers and confirm covers update without changing rating, status, progress, or notes.
- Fetch an AniList username import if enabled.
- Upload a Generic CSV import if enabled.

## Backup

- Export JSON and confirm the file contains the metadata wrapper and items.
- Export CSV and confirm notes/progress are readable.
- Upload the exported JSON and confirm restore preview appears before writing.
- Restore a selected subset.
- Restore the same subset again and confirm duplicates are skipped.
- Export JSON v2 and verify lists/references, including an empty list.
- Keep v1/legacy item-only restore compatible.
- Select lists separately from items; omitted items must not be restored or linked automatically.
- Confirm restored lists are private, with fresh IDs and no public slug.
- Confirm existing same-name lists are skipped without merging or overwriting.
- Test partial list/link failures and review counts before any retry.
- Verify exports over the configured API row limit are complete and reject partial-page errors.
- Confirm malformed notes/progress are reported invalid, not silently changed.
- Confirm missing activity timestamps stay missing after restore.

## Lists

- Create a custom list.
- Rename the list.
- Add existing vault items to the list.
- Confirm cover previews use only owned items and duplicate/concurrent additions are skipped.
- Remove an item from the list and confirm the item remains in Library.
- Delete the list and confirm vault items are not deleted.
- If public lists are enabled, make a list public and open `/u/[username]/lists/[listSlug]`.

## Public Profile Safety

- Set a display name and username in Settings.
- Enable Public Vault.
- Open `/u/[username]` logged out or incognito.
- Confirm the public profile is read-only.
- Confirm no owner email appears.
- Confirm Add New, Edit, Delete, Bulk Delete, Backup, Import, Settings, Add to List, and +1 progress controls are hidden.
- Turn Public Vault off and confirm `/u/[username]` shows a private state.
- Turn a public list private and confirm its public URL no longer reveals items.
- Check legacy `/share/[user_id]` hides private header/bottom-nav actions even for a signed-in visitor.
- Confirm `/share/me` still has the owner's normal private navigation.

## Analytics and Navigation

- Open Summary and Stats after adding/importing items.
- Confirm rating averages exclude unrated items.
- Confirm media type, status, genres, and monthly additions charts render.
- Test Library filters and sorting together.
- Test mobile nav at a narrow viewport.
- Confirm Logout is reachable from the mobile menu.
- Switch English/Russian in Settings, reload, and verify the language persists without garbled text.
- Test blocked localStorage and failed locale requests; selection should remain usable and retryable.
- Confirm translated labels never change stored status/type values or notes, and keep the partial-translation beta notice accurate.

## Production Readiness

- Run `npm run lint`.
- Run `npm test` for isolated tests without account or database writes.
- Run `npm run build`.
- Search for legacy episode-specific progress column names and confirm none exist.
- Confirm `.env.local` and real secrets are not committed.
- Confirm `NEXT_PUBLIC_SITE_URL` is set in Vercel.
- Confirm Supabase Auth Site URL and Redirect URLs match production.
- Confirm Supabase RLS policies are applied for items, profiles, lists, and list items.

## Current Verification Boundary

Automated component/action/API tests use synthetic fixtures and mocked database
writes. Local browser checks cover responsive layout and read-only interactions.
Opt-in provider tests make public metadata reads only. Real sign-up emails,
authenticated saves/imports/restores and cross-account RLS checks remain manual;
do not mark them passed from a successful build or mocked test alone.
