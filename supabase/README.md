# Database workflow

Production project: `bmixlqmelhnoksksoehb`. Verified 2026-10-28.

## Existing production

Compare the remote migration ledger with filenames in `migrations/`. Only apply
unapplied, reviewed forward migrations to this exact project. Never reset it,
replay `legacy/`, or mark those files applied: they never formed a complete
baseline and some reopen private reads or rewrite progress values.

The four P0 files match the remote ledger. The P1 progress migration adds only
nullable `last_progress_at`, an owner/date index, and updates the fixed public
projection from a NULL placeholder to the real timestamp. It changes no existing
row values or policies. Lock/statement timeouts and a transaction make failure
atomic. No fabricated historical progress dates are backfilled.

`progress` and `total_progress` are the canonical counters. The archived focus
shelves SQL's `current_page`, `total_pages`, and `total_episodes` are obsolete
duplicate storage; current writes and reads do not require them. Do not add them
or rewrite movie data merely to reproduce that historical script.

## Fresh Supabase projects

1. Run `bootstrap.sql` **only on an empty application schema**. Its guard refuses
   an existing application database. It captures reviewed production table
   metadata, owner/public-profile policies, grants, triggers, and cover storage
   configuration, with no user data. Supabase's managed auth/storage schemas
   must already exist. The trigger helper pins its search path.
2. Apply every SQL file in `migrations/` in ascending filename order.
3. Configure Auth URLs and app environment separately. Run local tests and the
   opt-in real-session authorization verifier with synthetic fixtures.

Bootstrap is deliberately outside the remote ledger, avoiding fabricated entries
for a database originally configured manually. Archive files are retained byte
for byte for historical reference. Fresh bootstrap still needs an integration
run on an isolated Supabase project before treating new-project provisioning as
automated; no local PostgreSQL/Docker runtime was available during this fix.

## Rollback

Rollback application code if needed while retaining additive schema changes.
Do not drop the new column after tracking writes: that would lose timestamps.
The P0 `public_items` projection remains an intentional SELECT-only definer view
with explicit visibility and field allowlists. Never restore a public SELECT
policy on base `items`, include notes in the view, or replay old sharing SQL.
