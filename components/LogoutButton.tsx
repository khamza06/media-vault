'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { logoutAction } from '../app/actions/auth'
import { useLocale } from './LocaleProvider'
import { useToast } from './ToastProvider'

export default function LogoutButton({
  className,
}: {
  className?: string
}) {
  const router = useRouter()
  const { t } = useLocale()
  const { showToast } = useToast()
  const pending = useRef(false)
  const [isPending, setIsPending] = useState(false)

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={async () => {
        if (pending.current) return
        pending.current = true
        setIsPending(true)
        try {
          await logoutAction()
          router.replace('/login')
          router.refresh()
        } catch {
          showToast('Could not confirm logout. Check your connection and try again.', 'error')
        } finally {
          pending.current = false
          setIsPending(false)
        }
      }}
      className={
        className ??
        'min-h-11 rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-blue-400/30 hover:bg-white/10 hover:text-white'
      }
    >
      {t('common.logout')}
    </button>
  )
}
