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

## Remaining boundaries

The existing product model makes every item row of a public profile public,
including notes through the Data API. These migrations close private-profile
exposure; they do not introduce field-level privacy or per-item visibility.
Private lists hide membership, not items already visible in a public vault.
Public cover URLs retain their existing storage behavior.

Already downloaded data cannot be recalled. These checks do not establish
whether earlier exposure was exploited, and do not test full browser workflows.

Do not roll back by restoring unrestricted SELECT. If a legitimate flow fails,
repair its specific policy while preserving private-profile denial.
