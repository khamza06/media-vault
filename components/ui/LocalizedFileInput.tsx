'use client'

import { useId, useState, type InputHTMLAttributes } from 'react'
import { useLocale } from '../LocaleProvider'
import { ui } from '../../lib/ui-i18n'

/** Keep the native file input and keyboard behavior; localize its visible browser-dependent chrome. */
export default function LocalizedFileInput({ id, onChange, disabled, className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const { locale } = useLocale()
  const generatedId = useId()
  const inputId = id ?? generatedId
  const [fileName, setFileName] = useState('')
  return <div className={`mt-4 min-w-0 ${className ?? ''}`}>
    <input {...props} id={inputId} type="file" disabled={disabled} className="peer sr-only" onChange={event => { setFileName(event.target.files?.[0]?.name ?? ''); onChange?.(event) }} />
    <label htmlFor={inputId} className={`flex min-h-12 min-w-0 items-center gap-3 rounded-xl border border-slate-700 bg-slate-950 pr-3 text-sm peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue-400 ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-blue-400'}`}>
      <span className="flex min-h-12 shrink-0 items-center rounded-l-xl bg-blue-500 px-4 py-3 font-semibold text-white">{ui(locale, 'Choose file')}</span>
      <span className="min-w-0 truncate text-slate-300" title={fileName || undefined}>{fileName || ui(locale, 'No file selected')}</span>
    </label>
  </div>
}
