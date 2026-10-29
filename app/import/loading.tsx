
import { ui } from '../../lib/ui-i18n'
import { getRequestLocale } from '../../lib/i18n-server'
import RouteLoadingShell from '../../components/RouteLoadingShell'

export default async function ImportLoading() {
  const locale = await getRequestLocale()

  return <RouteLoadingShell cardCount={4} eyebrow={ui(locale, "Import Center")} titleWidth="w-80" />
}
