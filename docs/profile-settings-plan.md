# Public Profile and Public List Setup

Media Vault supports username-based public profiles at:

```text
/u/[username]
```

The public profile is read-only. Visitors can see vault items only when the
owner has enabled `profiles.is_public = true`.

## Public Profile Migration

Run this Supabase migration:

```text
supabase/migrations/20260427_public_profiles.sql
```

It creates:

- `public.profiles`
- username uniqueness and format constraints
- `updated_at` trigger support
- profile RLS policies
- a public item read policy gated by `profiles.is_public`

## Profiles RLS Behavior

Authenticated users can:

- select their own profile
- insert their own profile
- update their own profile

Public/anonymous visitors can:

- select profiles only when `is_public = true`

Public visitors cannot:

- insert profiles
- update profiles
- delete profiles

## Items RLS Behavior

The migration removes the old broad public item read policy and replaces it with:

```sql
exists (
  select 1
  from public.profiles
  where profiles.id = items.user_id
    and profiles.is_public = true
)
```

This means public users can only read items owned by public profiles.

## Settings UI

Users can manage these fields on `/settings`:

- display name
- username
- public/private vault toggle

Rules:

- username must be 3-30 characters
- username is normalized to lowercase
- username can only use lowercase letters, numbers, underscores, and hyphens
- public vault cannot be enabled without a valid username

## Testing Checklist

1. Run the migration in Supabase.
2. Visit `/settings` while signed in.
3. Try invalid usernames: spaces, uppercase, too short, special characters.
4. Save a valid username.
5. Enable public vault.
6. Open `/u/[username]` in a logged-out/incognito browser.
7. Confirm the vault appears read-only.
8. Confirm no edit, delete, bulk delete, import, backup, or list-management controls appear.
9. Turn public vault off.
10. Confirm `/u/[username]` shows a private state.

## Public Custom Lists

Media Vault supports read-only public custom list URLs:

```text
/u/[username]/lists/[listSlug]
```

Run this migration after the profile migration:

```text
supabase/migrations/20260427_public_profiles_lists.sql
```

It adds these fields to `public.lists`:

- `is_public boolean not null default false`
- `slug text`

List slugs are unique per user, not globally. Slugs must be 3-60 characters
and can only use lowercase letters, numbers, underscores, and hyphens.

Public list sharing is gated twice:

- the list must have `lists.is_public = true`
- the owner profile must have `profiles.is_public = true`

Public visitors can select public lists and their list item rows only when both
conditions are true. Public visitors cannot insert, update, delete, add items,
or remove items from custom lists.

Owners can configure list sharing from `/lists`. Lists remain private by
default, and deleting a list still does not delete media items from the vault.

## Public List Testing Checklist

1. Run `supabase/migrations/20260427_public_profiles.sql`.
2. Run `supabase/migrations/20260427_public_profiles_lists.sql`.
3. Visit `/settings`, set a username, and enable Public Vault.
4. Visit `/lists`, open sharing settings for a custom list, set a slug, and make it public.
5. Open `/u/[username]` and confirm the Public Lists section shows only public lists.
6. Open `/u/[username]/lists/[listSlug]` logged out or incognito.
7. Confirm items render read-only with no edit, delete, add-to-list, remove, or bulk controls.
8. Turn the list private and confirm the public list URL no longer reveals it.
9. Turn Public Vault off and confirm all public list URLs are hidden.

## Security Notes

- Public profiles never expose the owner's email.
- `/u/[username]` should not show private account controls.
- `/u/[username]/lists/[listSlug]` is read-only and requires both a public profile and a public list.
- Existing item fields are reused; no item columns were added.
- The item progress column remains `progress`; do not add media-specific progress columns.
