'use client'

import { startTransition } from 'react'
import { useRouter } from 'next/navigation'

import { logoutAction } from '../app/actions/auth'
import { useLocale } from './LocaleProvider'

export default function LogoutButton({
  className,
}: {
  className?: string
}) {
  const router = useRouter()
  const { t } = useLocale()

  return (
    <button
      type="button"
      onClick={() =>
        startTransition(async () => {
          await logoutAction()
          router.push('/login')
          router.refresh()
        })
      }
      className={
        className ??
        'min-h-11 rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-blue-400/30 hover:bg-white/10 hover:text-white'
      }
    >
      {t('common.logout')}
    </button>
  )
}
