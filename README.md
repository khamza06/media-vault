# Media Vault

Personal media tracker for anime, manga, manhwa, manhua, movies, TV series, and books.

Built with:

- Next.js 16 App Router
- TypeScript
- Tailwind CSS
- Supabase Postgres + Auth

## Features

- Private user accounts with Supabase Auth
- Add, edit, delete, and browse media entries
- One-click quick import from MangaLib, ReManga, and Kinopoisk URLs
- Search, filter, and sort the library
- Item detail pages
- Stats dashboard
- JSON backup export and import
- Optional genre tags with search and stats
- Toast notifications
- Query state synced to the URL

## Local development

Create `.env.local` with:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
# optional but recommended for production previews
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Install dependencies and start the app:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Supabase setup

### 1. Database table

The app expects an `items` table with:

- `id uuid primary key`
- `title text`
- `type text`
- `status text`
- `progress int`
- `rating int`
- `image_url text`
- `created_at timestamp`

### 2. User ownership + RLS

Run the SQL migration:

```text
supabase/migrations/20260326_auth_user_ownership.sql
```

This adds `user_id`, creates an index, enables row-level security, and scopes rows to the signed-in user.

Until this migration is applied, the app runs in compatibility mode and shows an in-app setup notice.

### 3. Auth redirect URLs

In Supabase Auth settings, add:

```text
http://localhost:3000/auth/confirm
https://your-domain.com/auth/confirm
```

The signup flow sends email confirmations through that route.

### 4. Optional Storage bucket for cover uploads

If you want uploadable cover images in the add/edit forms, also run:

```text
supabase/migrations/20260326_storage_media_covers.sql
```

This creates a public `media-covers` bucket with authenticated upload/delete rules scoped to each user's folder.

### 5. Optional item metadata fields

If you want richer tracking fields like notes, total progress, and start/finish dates, also run:

```text
supabase/migrations/20260326_item_metadata.sql
```

### 6. Optional favorites

If you want favorites, quick starring, and favorites filters in the library, also run:

```text
supabase/migrations/20260326_item_favorites.sql
```

### 7. Optional genres

If you want genre tags, genre-aware search, and top-genre stats, also run:

```text
supabase/migrations/20260326_item_genres.sql
```

## Useful scripts

```bash
npm run dev
npm run lint
```

Type-check:

```bash
node_modules/.bin/tsc --noEmit
```

## Notes

- Home, stats, and item pages are server-rendered.
- Mutations use Next.js Server Actions.
- Supabase reads are server-side.
- Image covers are rendered with `next/image`.
- Backups can be exported from `/backup` and imported back into the signed-in account.
