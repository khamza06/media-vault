
import { ui } from '../../lib/ui-i18n'
import { getRequestLocale } from '../../lib/i18n-server'
import RouteLoadingShell from '../../components/RouteLoadingShell'

export default async function StatsLoading() {
  const locale = await getRequestLocale()

  return <RouteLoadingShell cardCount={8} eyebrow={ui(locale, "Stats")} titleWidth="w-64" />
}
