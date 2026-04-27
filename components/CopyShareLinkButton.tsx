'use client'

import { Check, Link2 } from 'lucide-react'
import { useState } from 'react'

export default function CopyShareLinkButton({
  userId,
  pathPrefix = '/share/',
  label = 'Copy My Secret Share Link',
  copiedLabel = 'Link copied',
}: {
  userId: string
  pathPrefix?: '/share/' | '/public/'
  label?: string
  copiedLabel?: string
}) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const origin = window.location.origin
    const shareUrl = `${origin}${pathPrefix}${userId}`

    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/15 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500/25"
    >
      {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
      {copied ? copiedLabel : label}
    </button>
  )
}
