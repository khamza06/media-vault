'use client'

import { Grid3X3, LayoutGrid, List } from 'lucide-react'
import { useVaultPreferences } from './VaultPreferencesProvider'
import { useLocale } from './LocaleProvider'

const views = [
  { value: 'comfortable', label: 'library.comfortable', icon: LayoutGrid },
  { value: 'compact', label: 'library.compact', icon: Grid3X3 },
  { value: 'table', label: 'library.table', icon: List },
] as const

export default function LibraryViewControls() {
  const { view, setView } = useVaultPreferences()
  const { t } = useLocale()
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2" role="group" aria-label={t('library.view')}>
      {views.map(({ value, label, icon: Icon }) => (
        <button key={value} type="button" aria-pressed={view === value}
          onClick={() => setView(value)}
          className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 ${view === value
            ? 'border-blue-400/40 bg-blue-500/15 text-blue-100'
            : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-600 hover:text-slate-100'}`}>
          <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />{t(label)}
        </button>
      ))}
    </div>
  )
}
