"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect, useSyncExternalStore } from "react";
import { localeCookieName, resolveLocale } from '../lib/i18n';
import { ui } from '../lib/ui-i18n';

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  const locale = useSyncExternalStore(() => () => {}, () => resolveLocale(document.cookie.split('; ').find(row => row.startsWith(`${localeCookieName}=`))?.split('=')[1]), () => 'en' as const);
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang={locale}>
      <body>
        <main style={{ padding: '2rem', maxWidth: '40rem', margin: 'auto', fontFamily: 'sans-serif' }}>
          <h1>{ui(locale, 'The vault hit an unexpected error')}</h1>
          <p>{ui(locale, 'Please try again. If the problem persists, reload the page.')}</p>
          <button type="button" onClick={() => window.location.reload()} style={{ minHeight: 44, padding: '0.5rem 1rem' }}>{ui(locale, 'Try again')}</button>
        </main>
      </body>
    </html>
  );
}
