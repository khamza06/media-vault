# Daily tracking — 2026-10-29

## Existing behavior and focused changes

Continue already used the filtered Library, last_progress_at, six recent
Watching/Reading/Re-Watching works and the shared cards. Quick +1 and personal
progress fields existed. There was no event history. The previous +1 performed
a read and absolute write, could lose concurrent updates, used React state as
its click guard, and rolled back entire stale item objects on error. Manga-family
Planning entries could incorrectly become Watching. Home shelves also overrode
explicit user sort choices.

The shared quick-progress hook now has a synchronous per-item guard, pending
feedback, an inline safe retry, localized episode/chapter/page labels and a
confirmed server snapshot. A lost acknowledgement retains the original expected
progress/timestamp. Retrying reconciles an already applied change. Two devices
acting on the same version produce one update and one explicit conflict: the
latest state is shown and the user can deliberately take the next step.
There is no automatic mutation retry or blind increment fallback. Notes, ratings
and other unrelated fields are never included in the progress update payload.

The authenticated JSON route avoids waiting for a full Library/recommendation
render before acknowledging +1. It bounds the request, checks origin/version,
uses the ordinary user's JWT and an invoker RPC, and sends private/no-store
responses. Foreign/missing items are indistinguishable. Focus refreshes the
current Library to pick up another device's changes; there is no polling or
promise of real-time synchronization while a page stays in the background.
The old Server Action entrypoint remains compatible and delegates to the RPC.

Continue reuses existing mouse arrows/drag, native touch and keyboard carousel
behavior. Exhausted totals leave Continue; status is not silently changed to
Completed except for the existing watched-movie behavior. The default sort is
Recently updated; Recently added and existing saved explicit sorts still work.
Home shelves preserve the chosen ordering within each shelf.

## Database and private activity

`20261029082618_daily_progress_activity.sql` matches production migration history.
It adds an authenticated SECURITY INVOKER `advance_item_progress` RPC with a short
row lock and compare-and-swap on both progress and last_progress_at. A stale
version returns current public-to-owner tracking fields without another write.
The supplied version does not replace ownership: existing items RLS and explicit
auth.uid ownership checks both apply.

`progress_events` stores only owner/item IDs, media type, old/new progress and
server time. Owner-only SELECT RLS applies even when the profile is public.
Anon has no access; ordinary clients cannot insert/update/delete journal rows.
A private, fixed-search-path definer trigger is the only writer. It records
actual UPDATE progress changes and sets their server timestamp in the same
transaction. Journal failure rolls back the mutation too. Unchanged progress,
notes/rating-only edits and initial insert/import do not fabricate events or
change the old progress timestamp. Both upward steps and corrections are kept.
Item/account deletion cascades owned history. Indexes cover recent-owner reads
and item deletion. No historical backfill, account rewrite or new public fields.
Existing public_items definition, item/profile/list policies are unchanged.

The Library's collapsible Recent progress loads the latest12 owner events only
on request, with no-store headers, loading/error/retry states. It displays current
item titles and the media unit recorded at the time. Empty history explains that
older activity has not been reconstructed. Existing public last_progress_at
metadata remains as before; the new journal itself is always private.

## Rollout, tests and rollback

DDL and authorization were tested in rolled-back production transactions before
applying the additive migration. Synthetic controls exercised all7 media types,
replayed requests, limits, corrections, owner isolation, forged-history denial
and exact notes/rating preservation. No real user rows were used as test inputs.
The browser regression uses ordinary authenticated sessions for two devices,
lost committed responses, same-frame duplicate clicks, mobile keyboard use,
history privacy and public-list membership/notes isolation.

Rollback the application first. The additive schema is compatible with the old
application and can remain in place. To disable journaling later, detach only
the new trigger and remove its two new functions after all callers are reverted.
Retain/archive progress_events rather than dropping recorded user history.
Never reset progress/timestamps or replay historical sharing migrations.
