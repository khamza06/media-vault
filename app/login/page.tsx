import { redirectIfAuthenticated } from '../../lib/auth/dal'
import AuthForm from '../../components/AuthForm'
import { t } from '../../lib/i18n'
import { getRequestLocale } from '../../lib/i18n-server'

export const revalidate = 0
export const dynamic = 'force-dynamic'

export default async function LoginPage(props: PageProps<'/login'>) {
  await redirectIfAuthenticated()
  const locale = await getRequestLocale()
  const searchParams = await props.searchParams
  const confirmed = searchParams.confirmed === '1'
  const passwordReset = searchParams.reset === '1'
  const authError =
    searchParams.authError === 'invalid-link'
      ? t(locale, 'auth.invalidLink')
      : searchParams.authError === 'missing-link'
        ? t(locale, 'auth.missingLink')
        : null

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl items-center px-4 py-10 pb-32 sm:px-6 lg:px-8">
      <div className="grid w-full min-w-0 gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <section className="min-w-0 space-y-6">
          <div className="inline-flex items-center gap-3 text-2xl font-bold tracking-tight text-white">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/20 text-sm font-semibold text-blue-200 shadow-[0_0_30px_rgba(59,130,246,0.2)]">
              MV
            </span>
            <span>
              {t(locale, 'brand.name')}<span className="text-blue-400">.</span>
            </span>
          </div>
          <p className="text-xs font-medium uppercase tracking-[0.35em] text-blue-300/70">
            {t(locale, 'auth.privateVault')}
          </p>
          <h1 className="max-w-xl text-5xl font-bold tracking-tight text-white sm:text-6xl">
            {t(locale, 'auth.loginHeading')}
          </h1>
          <p className="max-w-xl text-lg leading-8 text-slate-300">
            {t(locale, 'auth.loginDescription')}
          </p>
        </section>

        <AuthForm
          initialEmail={typeof searchParams.email === 'string' ? searchParams.email : ''}
          initialMessage={
            confirmed
              ? t(locale, 'auth.emailConfirmed')
              : passwordReset
                ? 'Password updated. Please sign in with your new password.'
                : authError ?? ''
          }
          initialMessageTone={confirmed || passwordReset ? 'success' : authError ? 'error' : null}
        />
      </div>
    </main>
  )
}
