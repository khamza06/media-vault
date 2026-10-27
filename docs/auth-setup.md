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

Both `/auth/callback` and `/auth/confirm` accept token-hash confirmation links.

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

The app stores its server session in HttpOnly cookies, separately from the browser
Supabase client. Use the following token-hash templates so the server can verify
the link and set those cookies, including when opened on another device.
This is dashboard configuration; sending an email successfully does not prove
that the template or the eventual session is correct.

Confirm signup:

```text
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/
```

Recovery:

```text
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/auth/reset-password
```

Do not assume an implicit-flow URL with `#access_token=...` will establish the
server cookie session at `/auth/callback`: URL fragments are not sent to Route
Handlers. Code-based PKCE callbacks additionally need the matching verifier;
the token-hash templates above do not depend on a verifier stored on the original
device. Keep template tokens private and never copy a real link into logs.

See the [Supabase server-side email flow](https://supabase.com/docs/guides/auth/server-side/nextjs)
and [email templates](https://supabase.com/docs/guides/auth/auth-email-templates).

## Automated vs Live Checks

`npm test` checks action results, redirects, password preservation and recovery
session initialization with synthetic data. It does not send email, validate a
real password, or verify the deployed dashboard configuration. Complete the Auth
section of [the QA checklist](final-qa-checklist.md) with a test account before
claiming the live email flow has been verified.

## Email Delivery Notes

- If emails do not arrive, check the spam folder first.
- Supabase default email sending can be limited or less reliable for production.
- For a production portfolio, configure a custom SMTP provider for better
  reliability and branding.
- If a confirmation link opens `localhost:3000` on mobile, the Supabase Site URL,
  Redirect URLs, or `NEXT_PUBLIC_SITE_URL` are still configured for local
  development instead of production.
