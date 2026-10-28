# Localization

English is the default. Settings offers Russian as an explicitly labelled beta.
This is not a claim that every screen is translated: navigation and existing
dictionary-backed controls are translated, while several newer screens still
use English copy. Extend coverage page-by-page rather than translating stored
values or applying automatic string replacement at runtime.

## Preference and Safety

- The server reads the supported locale from `media-vault-locale` per request.
- The switch updates local UI, best-effort browser storage and a same-site cookie,
  then confirms through `/api/locale` before refreshing server components.
- Blocked localStorage does not prevent cookie persistence. A failed request
  releases pending state, preserves the chosen local language and offers a retry
  by clicking the selected language again. It does not silently report success.
- The document language also follows the current UI for accessibility, including
  an offline local choice. Server-rendered pages start in the cookie language.
- The locale API accepts exact `en`/`ru` codes, rejects malformed bodies, and
  changes only the language cookie. No profile, RLS or auth credential is changed.
- Language is a browser preference, not synced account data or a backup field.

## Content Rules

Keep dictionary keys and interpolation variables identical across languages.
Russian text must be valid Unicode, not a double-decoded legacy encoding.
Display helpers can translate types/statuses, including Re-Watching, but option
values and database fields remain the original English model. Never translate
user titles, Markdown notes, IDs or exported tracking data.

Manrope already includes Cyrillic. Check mobile tab width and the menu footer
after translations: a longer label must not cover Add New/Logout or create page
overflow. Full navigation labels remain available to assistive technology even
when a narrow tab truncates its visual text.

## Verification

Tests check dictionary key/placeholder parity, exact Russian labels, locale
validation, request cookies, storage/network failures and retry. Synthetic
browser checks switch English/Russian, reload, and verify server language and
responsive navigation without a real login or database write. Remaining work:
page-specific Library/Discover/Import/Backup/Lists/Settings copy and consistent
localized action feedback; auth email delivery remains a separate manual check.
