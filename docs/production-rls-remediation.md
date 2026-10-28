# Production RLS remediation — 2026-10-28

Production `/api/auth-health` confirmed that the deployed application uses the
audited Supabase project. No environment values or keys are retained here.

Applied tracked migrations:

- `20261028122537_remove_unrestricted_item_reads.sql` removes the unconditional
  item SELECT policy and its historical alias. Owner and public-profile policies,
  grants, accounts and application data are unchanged.
- `20261028122658_restore_public_list_membership_reads.sql` permits public
  membership reads only for public profiles and public lists with a slug and
  consistent membership/list/item ownership. Owner policies remain intact.

The historical migration ledger was empty. Only these two new migrations were
applied; **do not run `db push` or replay old migrations against production**
until historical schema/ledger drift is reconciled. Old SQL includes a broad
sharing policy that must not be applied in isolation.

## Verification

33 live API checks passed using two disposable, confirmed synthetic accounts
and real Supabase password-sign-in sessions. The verifier uses only the ordinary
anon/publishable client key and user JWTs, never a service-role client.
Administrative SQL provisioned synthetic fixtures and removed only their exact
IDs afterward; it was not used to simulate user authorization. Existing user
records were not retrieved or modified. Scoped cleanup queries confirmed zero
remaining test users, items, lists and memberships.

Repository verification: `npm test` passed all 410 tests in 53 files;
`npm run lint`, `node --check scripts/verify-production-rls.mjs` and
`git diff --check` passed. A new application build/deployment is unnecessary for
these database-only runtime changes and was not performed. New migrations and
the verifier are retained locally; they have not been pushed.

Independent source review found no surviving private-item bypass or owner/public
sharing regression. Its migration-portability finding was addressed: the local
removal uses `IF EXISTS` for environments without the manually created legacy
policy. Production originally removed that confirmed-present policy directly;
the conditional removal was also parsed/executed inside a rolled-back transaction
afterward, without changing the final policy state.

Covered: owner access and writes; anonymous/other-user private denial; public
profile reads; public membership reads; private-list/null-slug denial; independent
membership-owner/item-owner mismatches; denied cross-user updates/deletes/list
inserts; preserved notes; profile/list visibility revocation. All item and
membership reads were restricted to known synthetic UUIDs.

`scripts/verify-production-rls.mjs` retains the focused verifier. It requires
explicit `MEDIA_VAULT_RLS_VERIFY=1` and an in-memory JSON
`MEDIA_VAULT_RLS_FIXTURE` containing the separately provisioned fixture IDs and
temporary password. It does not provision or clean fixtures itself. Never put
credentials in a file, Git, logs or command history. Run only with disposable
fixtures and ensure cleanup even if a check fails. It is deliberately outside
default unit tests/CI and must never use real user IDs.

## Historical boundaries of the initial fix

The initial two migrations closed private-profile exposure but still exposed
notes of public profiles. The follow-up below closes that remaining boundary.
Private lists hide membership, not items already visible in a public vault.
Public cover URLs retain their existing storage behavior.

Already downloaded data cannot be recalled. These checks do not establish
whether earlier exposure was exploited, and do not test full browser workflows.

Do not roll back by restoring unrestricted SELECT. If a legitimate flow fails,
repair its specific policy while preserving private-profile denial.

## Public notes privacy — completed follow-up

Applied `20261028125052_add_notes_free_public_items.sql` and
`20261028125530_restrict_item_notes_to_owners.sql`. No notes were moved, cleared,
rewritten or copied into another table. All existing owner CRUD/import/backup
paths continue using `items`; its SELECT access is now owner-only, including a
restrictive owner policy that prevents future permissive sharing policies from
silently reopening notes.

Public profiles, public lists and legacy UUID/share readers use `public_items`.
This intentional security-barrier definer view has a fixed column allowlist,
an explicit public-profile predicate and SELECT-only grants. It contains no
notes column. Public discovery cannot search/filter notes, and its loader strips
unexpected non-public fields before serialization. No fallback reads the base
table. Private owner discovery retains title/notes search and exact notes.

The view requires the intended metadata/provider identity columns, confirmed
present in production. A missing optional `last_progress_at` is projected as
NULL; do not invent an activity date. Incomplete unrelated historical schemas
fail closed rather than reverting to broad reads. View creation must precede
the restriction migration; filenames match the production migration ledger.

### Rollout and verification

1. Created the notes-free view without removing existing access.
2. Verified 418 unit/component tests, TypeScript, ESLint and production build.
3. Pushed `e67e34c`; Vercel confirmed READY production deployment
   `dpl_FFQSNEWAf8G2VyFcYGnozWfpvZGm` on media-vault.app.
4. Atomically restricted base-table reads and updated list membership reads to
   join the safe view. This preserved public sharing during the rollout.
5. Ran 59 live checks with two disposable confirmed accounts and real user JWTs:
   direct notes denial, note-filter inference denial, wildcard projection,
   rejected note selection/filtering, relationship embedding, rejected view
   writes, owner note preservation/writes, public/private profiles/lists,
   visibility revocation and inconsistent membership ownership.
6. Retrieved production `/u/[username]`, public list, `/public/[userId]` and
   `/share/[user_id]` for synthetic fixtures: all HTTP 200, expected media present,
   private note sentinel absent from HTML/RSC. No private real-user data queried.
7. Removed only the exact synthetic account IDs; verified zero remaining fixture
   users, items, lists and memberships. Existing users/data were not modified.

Before restriction, a UUID-scoped synthetic test reproduced note disclosure
through the old base API and confirmed the new projection omitted notes.
After restriction, the same class of direct access returned no rows for anon
and another authenticated user. Live checks use no service-role authorization;
administrative SQL is only used to provision and clean synthetic fixtures.

`tests/public-notes.test.ts` adds eight regressions for public loading,
serialization, fail-closed schema errors, legacy helpers, public genre/search
paths and retained owner notes. The live verifier accepts optional fixture
`siteUrl` to check deployed public HTML/RSC too. Credentials are memory-only.

### Advisor and rollback considerations

Supabase Advisor flags the intentional `security_invoker=false` view. This is a
reviewed exception: an invoker view cannot expose public media once base items
are owner-only. The fixed projection excludes notes, explicit profile filtering
guards rows, security_barrier protects the view boundary, and anon/authenticated
have no view write privileges. Never replace the projection with SELECT * or
remove its visibility predicate. The 59 real-session checks validate this boundary.
Pre-existing mutable function search_path and leaked-password-protection warnings
remain separate work; no unrelated Auth configuration was changed.

Rollback must retain owner-only base reads. Keep the safe view when rolling back
an application deployment; restoring the old public item policy would re-expose
notes. Already downloaded historical data cannot be recalled. Public cover URLs
and whole-public-profile media visibility remain as before.
