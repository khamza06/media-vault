# Dependency Maintenance

Baseline reviewed on 2026-10-27:

- Next.js runtime updated from 16.2.1 to 16.4.3.
- Sentry updated from 10.50.0 to 10.75.2 and its config import moved to
  `@sentry/nextjs/config` as recommended by the installed SDK.
- Transitive packages updated within their existing dependency ranges.
- Typography's pinned selector parser is overridden narrowly to patched 6.1.5
  (same major), rather than downgrading typography to npm audit's suggestion.
- `npm audit` reports zero known vulnerabilities for this lockfile at review time.

References: [Next.js advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw),
[Sentry advisory](https://github.com/getsentry/sentry-javascript/security/advisories/GHSA-mchm-gjx6-7h55),
[selector parser advisory](https://github.com/advisories/GHSA-rj75-hqrm-r3gf).

An advisory against an installed package is not evidence that a specific route
was exploited. For example, the Sentry tunnel-route condition is not enabled
here. Dependency updates do not replace application-level Auth and RLS checks.

The existing ESLint preset stays on 16.2.1 deliberately, with its previously
installed React Hooks plugin pinned to 7.0.1. Plugin 7.1.1 enables an additional
effect rule that flags existing components. That migration should be a separate
tested change, not an unrelated rewrite during a runtime patch. No lint rules
were disabled and no forced audit fixes were used.

Recheck periodically: advisory data changes and a clean audit is not a complete
security review. Keep the Node.js version consistent with CI (24).
