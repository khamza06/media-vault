'use client'

import { ui } from '../lib/ui-i18n'

import { Check, Link2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocale } from './LocaleProvider'

export default function CopyShareLinkButton({
  path,
  userId,
  pathPrefix = '/share/',
  copiedLabel,
  label,
}: {
  path?: string
  userId?: string
  pathPrefix?: '/share/' | '/public/'
  label?: string
  copiedLabel?: string
}) {
  const [copied, setCopied] = useState(false)
  const [manualUrl, setManualUrl] = useState('')
  const { locale, t  } = useLocale()
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 4000)
    return () => clearTimeout(timer)
  }, [copied])
  const buttonLabel =
    label ?? (path ? ui(locale, "Copy public profile link") : ui(locale, "Copy legacy share link"))

  async function handleCopy() {
    const sharePath = path ?? (userId ? `${pathPrefix}${userId}` : null)

    if (!sharePath) {
      return
    }

    const shareUrl = new URL(sharePath, window.location.origin).toString()
    try {
      await navigator.clipboard.writeText(shareUrl)
      setManualUrl('')
      setCopied(true)
    } catch {
      setCopied(false)
      setManualUrl(shareUrl)
    }
  }

  return (
    <>
    <button
      type="button"
      onClick={() => void handleCopy()}
      className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-blue-400/30 bg-blue-500/15 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500/25"
    >
      {copied ? <Check aria-hidden="true" className="h-4 w-4" /> : <Link2 aria-hidden="true" className="h-4 w-4" />}
      {copied ? (copiedLabel ?? ui(locale, "Link copied")) : buttonLabel}
    </button>
    <span role="status" className="sr-only">{copied ? (copiedLabel ?? ui(locale, "Link copied")) : ''}</span>
    {manualUrl ? <div className="min-w-0 basis-full space-y-2">
      <p role="alert" className="text-sm text-amber-200">{t('common.copyFailed')}</p>
      <input aria-label={t('common.shareLink')} readOnly value={manualUrl} onFocus={event => event.currentTarget.select()} className="min-h-11 w-full min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100" />
    </div> : null}
    </>
  )
}
