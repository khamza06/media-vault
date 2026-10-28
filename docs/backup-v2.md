# Backup v2

JSON export includes items, custom lists and list memberships. CSV remains
item-only. Legacy v1 files, item arrays and unversioned item wrappers still have
the existing preview/selected item restore flow.

## Format

```json
{
  "app": "Media Vault",
  "version": 2,
  "exported_at": "ISO timestamp",
  "items": [],
  "lists": [
    {
      "id": "original-list-uuid",
      "name": "Favorites",
      "description": null,
      "item_ids": ["original-item-uuid"]
    }
  ]
}
```

The example IDs above describe the fields; real files require canonical lowercase
UUIDs and each reference must identify an item in the file. Duplicate item/list
IDs, duplicate references and dangling references reject the preview. Item data
still receives the existing per-row validation, including notes/progress.

Owner IDs, public profile data, list visibility and public slugs are not exported
as list fields. Restore creates fresh list IDs owned by the signed-in user,
explicitly private with no public slug. Item restore also does not reuse old IDs
or owners. No schema migration is introduced by this increment.

## Selection and Mapping

1. Upload JSON; parsing and preview happen locally, without writing data.
2. Choose items as before. List restore is separately opt-in.
3. Review link counts. A selected list does not automatically select its items.
4. Restore selected data. Existing items are skipped, not overwritten.
5. Re-read the current user's items and map selected original IDs to owned IDs:
   exact canonical provider/type/ID first, then a unique normalized title/type.
6. Skip ambiguous identities and conflicting known same-provider IDs. Never
   trust an original item ID as a destination or attach an unselected item.
7. Create new lists and add mapped links using the existing unique membership
   constraint. Repeated normalized list names are skipped entirely: existing
   lists are not merged, renamed, republished or otherwise modified.

Matching names are checked against complete owner-scoped list reads, not just
the first API page. There is no new database-wide list-name unique constraint;
simultaneous independent list creation remains outside an atomic restore.

## Limits and Partial Results

- Preview files smaller than 20 MB. Only the first 250 items/lists are rendered;
  select-all still applies to all parsed valid candidates.
- A restore selection accepts at most 2,000 items, 100 lists, 20,000 membership
  references and 750,000 UTF-8 JSON bytes. Choose smaller groups for large files.
- Select all required items together with a list. Restoring another subset later
  does not append links to an existing same-name list.
- Item restore must succeed before list restore starts. Mapping read failures
  leave successfully processed items intact and do not create lists.
- List and membership results have separate restored/skipped/failed counts.
  Unconfirmed returned links are not counted as success or duplicate skips.
- A connection interruption may happen after a write. Refresh and review items
  and lists before retrying. Partial restores are not rolled back; matching list
  names on retry are skipped, not repaired automatically. Use existing private
  list tools to review/add missing links.

## Export Safety and Setup

Export keyset-pages owned items, lists and memberships to an empty page, including
when the API row cap is lower than the requested batch. A read failure does not
download a partial JSON backup. Inconsistent references (for example concurrent
vault changes) cancel export and ask for a refresh. This is not a transactional
snapshot; avoid editing the vault in another tab during export/restore.

Use the existing custom-list and public-list migrations, including
`20260426_custom_lists.sql` and `20260427_public_profiles_lists.sql`. All queries
use the current user's client and owner filter; existing RLS remains required.
No privileged client, new policy, update or deletion is used for collection
restore. If the lists table is absent, JSON falls back to explicitly labelled
item-only v1. Other list read failures disable JSON export; CSV remains usable.

## Verification

Tests mock auth/database writes and cover guest denial, mapping, malformed
graphs, size limits, duplicate names, private inserts, exact descriptions,
partial responses, network errors and item-only compatibility. Local browser QA
uses synthetic files only, never the user's vault. Account-level restore and
cross-account RLS checks remain a manual disposable-account task.
