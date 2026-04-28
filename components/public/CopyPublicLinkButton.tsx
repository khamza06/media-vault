'use client'

import { Check, Copy, Link2 } from 'lucide-react'
import { useState } from 'react'

type CopyPublicLinkButtonProps = {
  path: string
}

export default function CopyPublicLinkButton({ path }: CopyPublicLinkButtonProps) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCopy() {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    const url = `${window.location.origin}${normalizedPath}`

    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setError(null)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
      setError(url)
    }
  }

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={() => void handleCopy()}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-blue-400/30 bg-blue-500/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500/25 sm:w-auto"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? 'Copied' : 'Copy public profile link'}
      </button>

      {error ? (
        <p className="mt-2 break-all rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-400">
          <Link2 className="mr-1 inline h-3.5 w-3.5" />
          Copy this link manually: {error}
        </p>
      ) : null}
    </div>
  )
}
