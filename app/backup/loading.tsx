
import { ui } from '../../lib/ui-i18n'
import { getRequestLocale } from '../../lib/i18n-server'
import RouteLoadingShell from '../../components/RouteLoadingShell'

export default async function BackupLoading() {
  const locale = await getRequestLocale()

  return <RouteLoadingShell cardCount={4} eyebrow={ui(locale, "Backup")} titleWidth="w-72" />
}
