# Media Vault Auth Setup

This app uses Supabase Auth for email/password sign up, sign in, email
confirmation, and password reset.

Code alone cannot guarantee that confirmation or recovery emails are delivered.
The Supabase project dashboard and Vercel environment variables must also be
configured correctly.

## Required Environment Variables

Set this in Vercel for production:

```text
NEXT_PUBLIC_SITE_URL=https://media-vault.app
```

For local development, use this in `.env.local`:

```text
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

The app falls back to `https://media-vault.app` in production if
`NEXT_PUBLIC_SITE_URL` is missing, but the explicit environment variable is still
recommended so auth links are predictable.

## Supabase URL Configuration

Open Supabase Dashboard, then go to:

```text
Authentication -> URL Configuration
```

Set **Site URL** to:

```text
https://media-vault.app
```

Add these **Redirect URLs**:

```text
https://media-vault.app/auth/callback
https://media-vault.app/auth/reset-password
https://media-vault.app/auth/confirm
http://localhost:3000/auth/callback
http://localhost:3000/auth/reset-password
http://localhost:3000/auth/confirm
```

The app also keeps `/auth/confirm` for older token-hash email templates. If your
Supabase email templates still use `/auth/confirm`, also allow:

```text
https://media-vault.app/auth/confirm
http://localhost:3000/auth/confirm
```

## Email Provider Settings

Open Supabase Dashboard, then go to:

```text
Authentication -> Providers -> Email
```

If users should confirm email before signing in, enable:

```text
Confirm email
```

If this is disabled, Supabase may create a session immediately after sign up,
and the app will correctly show: `Account created. You are signed in.`

## Email Templates

Check these templates:

- Confirm signup
- Recovery / Reset password

For the current production callback flow, make sure the templates use Supabase's
confirmation/recovery URL variables and that the redirect URLs above are allowed.

If you prefer token-hash templates, these also work because the app keeps
`/auth/confirm`:

Confirm signup:

```text
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/
```

Recovery:

```text
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/auth/reset-password
```

## Email Delivery Notes

- If emails do not arrive, check the spam folder first.
- Supabase default email sending can be limited or less reliable for production.
- For a production portfolio, configure a custom SMTP provider for better
  reliability and branding.
- If a confirmation link opens `localhost:3000` on mobile, the Supabase Site URL,
  Redirect URLs, or `NEXT_PUBLIC_SITE_URL` are still configured for local
  development instead of production.
