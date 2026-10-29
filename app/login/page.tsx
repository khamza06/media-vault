
import { ui } from '../../lib/ui-i18n'
import { redirectIfAuthenticated } from '../../lib/auth/dal'
import AuthForm from '../../components/AuthForm'
import LanguageToggle from '../../components/LanguageToggle'
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
    <main className="vault-container flex min-h-[100svh] items-center py-8 sm:py-12">
      <div className="grid w-full min-w-0 gap-8 lg:grid-cols-2 lg:items-center lg:gap-16">
        <section className="min-w-0 space-y-5">
          <LanguageToggle interfaceOnly />
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
          <h1 className="max-w-xl text-[clamp(2rem,4.2vw,3.75rem)] font-bold leading-[1.08] tracking-[-0.045em] text-balance text-white">
            {t(locale, 'auth.loginHeading')}
          </h1>
          <p className="max-w-xl text-lg leading-8 text-slate-300">
            {t(locale, 'auth.loginDescription')}
          </p>
        </section>

        <div className="flex min-w-0 justify-center lg:justify-end">
          <AuthForm
            initialEmail={typeof searchParams.email === 'string' ? searchParams.email : ''}
            initialMessage={
              confirmed
                ? t(locale, 'auth.emailConfirmed')
                : passwordReset
                  ? ui(locale, "Password updated. Please sign in with your new password.")
                  : authError ?? ''
            }
            initialMessageTone={confirmed || passwordReset ? 'success' : authError ? 'error' : null}
          />
        </div>
      </div>
    </main>
  )
}
