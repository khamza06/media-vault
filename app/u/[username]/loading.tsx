
import { ui } from '../../../lib/ui-i18n'
import { getRequestLocale } from '../../../lib/i18n-server'
import RouteLoadingShell from '../../../components/RouteLoadingShell'

export default async function PublicProfileLoading() {
  const locale = await getRequestLocale()

  return <RouteLoadingShell cardCount={6} eyebrow={ui(locale, "Public Vault")} titleWidth="w-96" />
}
