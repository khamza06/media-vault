import { AlertCircle, CheckCircle2, LoaderCircle } from 'lucide-react'
import type { ReactNode } from 'react'

type ActionFeedbackProps = {
  tone: 'pending' | 'success' | 'error'
  children: ReactNode
}

export default function ActionFeedback({ tone, children }: ActionFeedbackProps) {
  const Icon = tone === 'pending' ? LoaderCircle : tone === 'error' ? AlertCircle : CheckCircle2
  const colors = tone === 'error'
    ? 'border-red-400/30 bg-red-500/10 text-red-100'
    : tone === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100' : 'border-blue-400/30 bg-blue-500/10 text-blue-100'

  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex min-w-0 items-start gap-2 rounded-xl border px-4 py-3 text-sm ${colors}`}>
      <Icon aria-hidden="true" className={`mt-0.5 h-4 w-4 shrink-0 ${tone === 'pending' ? 'animate-spin motion-reduce:animate-none' : ''}`} />
      <div className="min-w-0 break-words">{children}</div>
    </div>
  )
}
