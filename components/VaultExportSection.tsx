'use client'

import { Download, FileJson2, FileSpreadsheet } from 'lucide-react'
import { useState } from 'react'

import {
  getVaultExportFilename,
  serializeVaultExportCsv,
  serializeVaultExportJson,
  type VaultExportItem,
} from '../lib/backup'

type VaultExportSectionProps = {
  items: VaultExportItem[]
}

export default function VaultExportSection({ items }: VaultExportSectionProps) {
  const [activeFormat, setActiveFormat] = useState<'json' | 'csv' | null>(null)
  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] = useState<'error' | 'success' | null>(null)

  async function downloadExport(format: 'json' | 'csv') {
    if (items.length === 0) {
      setMessage('Your vault is empty. Add items before exporting a backup.')
      setMessageTone('error')
      return
    }

    setActiveFormat(format)
    setMessage('')
    setMessageTone(null)

    try {
      const content =
        format === 'json' ? serializeVaultExportJson(items) : serializeVaultExportCsv(items)
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
        `${format.toUpperCase()} export ready. Downloaded ${items.length} item${
          items.length === 1 ? '' : 's'
        }.`
      )
      setMessageTone('success')
    } catch {
      setMessage('Export failed. Please try again.')
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
          <h2 className="text-2xl font-semibold tracking-tight text-white">Export your vault</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Download your Media Vault library as JSON or CSV. JSON is recommended for
            restoring a Media Vault backup; CSV is best for spreadsheets.
          </p>
        </div>
      </div>

      <div className="mt-5 grid min-w-0 gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => void downloadExport('json')}
          disabled={activeFormat !== null}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(59,130,246,0.32)] transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <FileJson2 className="h-4 w-4" />
          {activeFormat === 'json' ? 'Preparing JSON...' : 'Export JSON'}
        </button>

        <button
          type="button"
          onClick={() => void downloadExport('csv')}
          disabled={activeFormat !== null}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-blue-400/30 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <FileSpreadsheet className="h-4 w-4" />
          {activeFormat === 'csv' ? 'Preparing CSV...' : 'Export CSV'}
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
          {message}
        </p>
      ) : null}

      <p className="mt-4 text-xs text-slate-500">
        Current export size: {items.length} item{items.length === 1 ? '' : 's'}.
      </p>
    </section>
  )
}
