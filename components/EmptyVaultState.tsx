'use client'

import { Sparkles } from 'lucide-react'

export default function EmptyVaultState({
  message,
}: {
  message: string
}) {
  return (
    <div className="glass-panel-soft col-span-full flex min-h-[220px] flex-col items-center justify-center gap-4 rounded-[28px] border border-dashed border-white/10 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-200">
        <Sparkles className="h-6 w-6" />
      </div>
      <p className="max-w-xl text-base text-slate-300">{message}</p>
    </div>
  )
}
