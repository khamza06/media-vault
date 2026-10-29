'use client'
import { translateMessage } from '../lib/ui-i18n'

import { ui, countNoun } from '../lib/ui-i18n'
import { useLocale } from './LocaleProvider'

import { Download, FileJson2, FileSpreadsheet } from 'lucide-react'
import { useState } from 'react'

import {
  getVaultExportFilename,
  serializeVaultExportCsv,
  serializeVaultExportJson,
  type VaultExportItem,
} from '../lib/backup'
import type { VaultExportList } from '../lib/backup-collections'

type VaultExportSectionProps = {
  items: VaultExportItem[]
  lists?: VaultExportList[]
  listExportError?: string | null
  listExportWarning?: string | null
}

export default function VaultExportSection({ items, lists, listExportError, listExportWarning }: VaultExportSectionProps) {
  const { locale } = useLocale()

  const [activeFormat, setActiveFormat] = useState<'json' | 'csv' | null>(null)
  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] = useState<'error' | 'success' | null>(null)

  async function downloadExport(format: 'json' | 'csv') {
    if (items.length === 0 && (format === 'csv' || !lists?.length)) {
      setMessage(ui(locale, "Your vault is empty. Add items or create a list before exporting JSON."))
      setMessageTone('error')
      return
    }

    setActiveFormat(format)
    setMessage('')
    setMessageTone(null)

    try {
      const content =
        format === 'json' ? serializeVaultExportJson(items, lists) : serializeVaultExportCsv(items)
      const mimeType = format === 'json' ? 'application/json' : 'text/csv;charset=utf-8'
      const blob = new Blob([content], { type: mimeType })
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')

      anchor.href = objectUrl
      anchor.download = getVaultExportFilename(format)
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(objectUrl)
      setMessage(
        ui(locale, "{value0} export ready. Downloaded {value1} item{value2}.{value3}", { value0: format.toUpperCase(), value1: items.length, value2: items.length === 1 ? '' : 's', value3: format === 'json' && lists ? ui(locale, " Includes {value0} lists. Sharing settings are not included.", { value0: lists.length }) : '' })
      )
      setMessageTone('success')
    } catch {
      setMessage(ui(locale, "Export failed. Please try again."))
      setMessageTone('error')
    } finally {
      setActiveFormat(null)
    }
  }

  return (
    <section className="min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-2xl shadow-slate-950/30 sm:p-7">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-100">
          <Download className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold tracking-tight text-white"> {ui(locale, "Export your vault")} </h2>
          <p className="mt-3 text-sm leading-6 text-slate-300"> {ui(locale, "Download your Media Vault library as JSON or CSV. JSON is recommended for restoring a Media Vault backup; CSV is best for spreadsheets.")} </p>
        </div>
      </div>
      <p className="mt-4 text-sm text-slate-400">JSON {lists ? ui(locale, "v2 includes items, lists and their memberships. Restored lists are always private.") : ui(locale, "v1 contains items only.")} {ui(locale, "CSV contains items only.")} </p>
      {listExportError || listExportWarning ? <p role={listExportError ? 'alert' : 'status'} className="mt-3 break-words rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">{listExportError ?? listExportWarning}</p> : null}

      <div className="mt-5 grid min-w-0 gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => void downloadExport('json')}
          disabled={activeFormat !== null || Boolean(listExportError)}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(59,130,246,0.32)] transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <FileJson2 className="h-4 w-4" />
          {activeFormat === 'json' ? ui(locale, "Preparing JSON...") : ui(locale, "Export JSON")}
        </button>

        <button
          type="button"
          onClick={() => void downloadExport('csv')}
          disabled={activeFormat !== null}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-blue-400/30 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <FileSpreadsheet className="h-4 w-4" />
          {activeFormat === 'csv' ? ui(locale, "Preparing CSV...") : ui(locale, "Export CSV")}
        </button>
      </div>

      {message ? (
        <p
          className={`mt-4 rounded-xl px-4 py-3 text-sm ${
            messageTone === 'success'
              ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
              : 'border border-red-500/30 bg-red-500/10 text-red-200'
          }`}
        >
          {translateMessage(locale, message)}
        </p>
      ) : null}

      <p className="mt-4 text-xs text-slate-500"> {ui(locale, "Current export size:")} {items.length} {countNoun(locale, items.length, "item")}.
      </p>
    </section>
  )
}
