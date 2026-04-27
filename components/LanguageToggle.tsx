'use client'

import { useLocale } from './LocaleProvider'

export default function LanguageToggle() {
  const { t } = useLocale()

  return (
    <div
      className="glass-panel-soft inline-flex items-center gap-1 rounded-full p-1"
      aria-label={t('common.language')}
    >
      <LanguageButton code="EN" isActive />
    </div>
  )
}

function LanguageButton({
  code,
  isActive = true,
}: {
  code: 'EN'
  isActive?: boolean
}) {
  return (
    <button
      type="button"
      disabled
      className={`rounded-full px-3 py-2 text-xs font-semibold tracking-[0.16em] transition ${
        isActive
          ? 'bg-blue-500 text-white shadow-[0_10px_24px_rgba(59,130,246,0.24)]'
          : 'text-slate-300'
      }`}
    >
      {code}
    </button>
  )
}
