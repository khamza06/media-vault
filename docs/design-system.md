# Media Vault Layout and Typography

## Visual References

These projects informed spacing, hierarchy, and dashboard density. Media Vault
keeps its existing navy and blue identity; their application code is not copied.

- [shadcn/ui](https://github.com/shadcn-ui/ui): accessible controls and consistent surfaces.
- [Midday](https://github.com/midday-ai/midday): restrained typography and dashboard density.
- [shadcn-admin](https://github.com/satnaing/shadcn-admin): responsive page and card alignment.

## Typography

Manrope is self-hosted through `next/font/local`. The variable font supports
Latin and Cyrillic. The original file and SIL Open Font License are in
`app/fonts/`, sourced from [Google Fonts](https://github.com/google/fonts/tree/main/ofl/manrope).
Builds and browsers do not need a font CDN connection.

- `vault-title`: responsive page headings, 30-44px, balanced wrapping.
- `vault-section-title`: section headings, 20-26px.
- `vault-metric`: tabular digits for comparable numerical values.
- Body text and form controls share the same font. Code retains a monospace font.

## Layout

- `vault-container`: centered 1280px outer width, including horizontal padding.
- `vault-page`: the same container, with consistent top and bottom spacing.
- Horizontal padding: 16px mobile, 24px tablet, 32px desktop.
- The header uses the same container as page content, without a second max-width.
- Keep filters, transforms, and backdrop filters off the header's inner wrapper:
  its mobile search overlay uses fixed viewport positioning. Add New uses a body portal.
- Desktop sticky panels use `--vault-header-offset` to clear the two-row header.
- Mobile content reserves bottom space for navigation and the device safe area.
- Small editor forms may remain narrower inside the page container.

## Media Cards

`lib/media-card-grid.ts` supplies one responsive grid: 2 / 3 / 4 / 5 / 6 columns.
Horizontal gaps are 16px on mobile and 20px from small screens; row gaps are 24px.
Grid cards fill their tracks. Horizontal home shelves explicitly use the `rail`
variant of `ShelfItemCard`, with a stable 168-184px width.

Do not combine fractional grid columns with a smaller fixed card max-width, or
use `justify-between` to distribute cards. Reserve two title lines and align card
actions at the bottom of each row.

## Detail Metrics

The detail editor keeps a two-column status/ratings layout only when space permits.
Ratings use their own container query so the two metric cards can stack when the
parent is narrow. Progress has a centered input between equal-width buttons.
The official rating empty state uses two explicit, nonbreaking lines.

## Responsive QA

Check 390px, 768px, 1280px, and 1440px widths after changing shared layout styles.
Verify page/header edges, card widths, readable select values, keyboard focus,
internal code scrolling, and mobile navigation clearance. Public grids must stay
read-only. Do not use global horizontal overflow hiding to conceal layout errors.

The 2026-10-26 browser pass used temporary local fixtures with the real shelf,
public grid, and quick editor components. At 390/768/1280/1366/1440/1920px,
the shelf had no document overflow and its content edge matched the header edge.
The rating controls also passed at 320px. Values `6 / 10`, `10 / 10`, and
`Not rated` remained one line; both rating fields measured 56px high.
Public title search and shelf status filtering/selection were exercised without
database writes. Authenticated save/import/restore operations were not exercised
in this visual pass. The temporary preview route is not part of the deployment.
The real Import Center was also checked locally: its mobile search overlay filled
the 390x844 viewport and Add New filled the 1440x900 viewport. No console errors
were reported in these checks.

## Library Browsing

The Library opens with three compact metrics for the current filtered view.
Detailed completion counts live in a collapsed section below the shelves.
Search, type, and status stay visible; cover, source, rating, and sorting live in
an accessible Advanced filters disclosure. Active chips clear one filter at a
time. Defaults are removed from the URL, and unrelated query parameters survive.

Missing artwork uses `CoverPlaceholder`: title initials, a media-type icon, and
a restrained navy/blue background. It does not create an image URL or change
missing-cover filters. Public cards use the same placeholder without controls.

`ActionFeedback` provides pending, success, and error messages with accessible
status/alert roles. Quick edits, full editing, imports, and backup restore reuse
it. Quick edits and restore always release their pending state after transport
errors; cover-upload failures also release the full edit form. No new write
fields or schema changes are involved.

The follow-up local browser pass checked 320/390/768/1280/1440px with no document
overflow. Type/status/search combinations, individual filter removal, bulk
selection/cancel, and Markdown edit/preview were exercised. Synthetic JSON,
CSV (including escaped quotes and multiline notes), and MAL files all produced
previews without importing. Public fixture grids had no mutation controls and
the browser reported no console errors. Successful authenticated saves, imports,
and restores still require a separate account-level test; this pass deliberately
did not modify the live vault. All temporary fixtures were removed before build.
