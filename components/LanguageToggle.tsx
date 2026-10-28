'use client'

import { useLocale } from './LocaleProvider'

export default function LanguageToggle() {
  const { locale, setLocale, t, isChangingLocale, localeError } = useLocale()
  return <div className="min-w-0 space-y-3">
    <div role="group" aria-label={t('common.language')} className="inline-flex flex-wrap gap-2 rounded-xl border border-slate-800 bg-slate-950 p-1">
      {([{ value: 'en', label: 'English' }, { value: 'ru', label: 'Русский (beta)' }] as const).map((option) => (
        <button key={option.value} type="button" lang={option.value} aria-pressed={locale === option.value} disabled={isChangingLocale} onClick={() => setLocale(option.value)}
          className={`min-h-11 rounded-xl px-4 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-blue-400 disabled:opacity-60 ${locale === option.value ? 'bg-blue-500 text-white' : 'text-slate-300 hover:bg-slate-900'}`}>{option.label}</button>
      ))}
    </div>
    <p className="text-xs leading-5 text-slate-400">{t('language.partial')}</p>
    {isChangingLocale ? <p role="status" className="text-sm text-slate-400">{t('common.saving')}</p> : null}
    {localeError ? <p role="alert" className="text-sm text-amber-200">{localeError}</p> : null}
  </div>
}
