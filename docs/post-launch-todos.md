# Post-launch TODOs

Non-critical ideas found during final QA. These are intentionally left out of
the production polish sprint to avoid expanding scope.

## Product polish

- Keep Supabase Auth URL Configuration synced with the custom domain after DNS or domain changes.
- Refresh README screenshots after the layout changes and record a short video demo.
- Add richer public profile customization such as bio, accent color, and featured lists.
- Add dynamic Open Graph metadata for individual public list pages.
- Add optional OAuth providers after email/password auth is stable.

## Import and backup UX

- Add richer long-running import progress UI for very large MAL/AniList/CSV imports.
- Add a small sample CSV download in Import Center.
- Add resumable recovery for partially restored lists only after explicit review;
  current v2 deliberately skips existing names rather than merging automatically.

## Visual polish

- Continue replacing older pill/chip `rounded-*` variants with `rounded-xl` in legacy form components.
- Add subtle page transition motion after core flows are fully stable.
- Create a dedicated portfolio case-study page with architecture notes and screenshots.

## Operations

- Configure custom SMTP in Supabase for branded and reliable auth emails.
- Enable Vercel Web Analytics and Speed Insights.
- Add automated smoke tests for auth redirects, public read-only routes, and backup restore preview.

## Next reliability checks

- Confirm list create/edit/sharing/delete transport recovery with a disposable
  account. Isolated tests now cover pending cleanup and draft preservation, but
  an interrupted real request may still have committed before its response failed.
- Run disposable-account restore/RLS checks for backup v2; mocked write coverage
  and synthetic-file browser checks do not verify a live database restore.
- Verify Add-to-list and bulk-action transport/partial recovery with a disposable
  account and throwaway items. Automated tests use mocked writes; browser QA
  opens/reviews/cancels synthetic dialogs without executing Add/Apply/Delete.
