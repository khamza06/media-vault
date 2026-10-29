'use client'

import { useLocale } from './LocaleProvider'
import { ui } from '../lib/ui-i18n'

export default function LanguageToggle({ interfaceOnly = false }: { interfaceOnly?: boolean }) {
  const { locale, setLocale, t, isChangingLocale, localeError, metadataLanguage, setMetadataLanguage } = useLocale()
  return <div className="min-w-0 space-y-3">
    <div role="group" aria-label={ui(locale, 'Interface language')} className="inline-flex flex-wrap gap-2 rounded-xl border border-slate-800 bg-slate-950 p-1">
      {([{ value: 'en', label: 'English' }, { value: 'ru', label: 'Русский' }] as const).map((option) => (
        <button key={option.value} type="button" lang={option.value} aria-pressed={locale === option.value} disabled={isChangingLocale} onClick={() => setLocale(option.value)}
          className={`min-h-11 rounded-xl px-4 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-blue-400 disabled:opacity-60 ${locale === option.value ? 'bg-blue-500 text-white' : 'text-slate-300 hover:bg-slate-900'}`}>{option.label}</button>
      ))}
    </div>
    {!interfaceOnly ? <>
    <p className="text-xs leading-5 text-slate-400">{ui(locale, 'Interface and metadata languages are independent. Preferences are saved in this browser; your library records are never renamed.')}</p>
    <label className="block space-y-2 text-sm font-semibold text-slate-200">
      <span>{ui(locale, 'Preferred media metadata language')}</span>
      <select value={metadataLanguage} disabled={isChangingLocale} onChange={event => setMetadataLanguage(event.target.value as 'ru' | 'en' | 'original')}
        className="min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-base text-slate-100 focus-visible:outline-2 focus-visible:outline-blue-400 disabled:opacity-60">
        <option value="ru">Русский</option><option value="en">English</option><option value="original">{ui(locale, 'Original')}</option>
      </select>
    </label>
    <p className="text-xs leading-5 text-slate-400">{ui(locale, 'Movies and TV use the selected metadata language when available. Missing translations fall back to English or the original. Other providers keep their existing metadata.')}</p>
    {metadataLanguage === 'ru' ? <p className="text-xs leading-5 text-slate-400">{ui(locale, 'Additional Russian titles and descriptions for Anime, Manga, Manhwa and Manhua are not enabled while provider permissions are being clarified. Existing catalog metadata remains available.')}</p> : null}
    </> : null}
    {isChangingLocale ? <p role="status" className="text-sm text-slate-400">{t('common.saving')}</p> : null}
    {localeError ? <p role="alert" className="text-sm text-amber-200">{localeError}</p> : null}
  </div>
}
