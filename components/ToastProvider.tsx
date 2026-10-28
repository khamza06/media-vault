'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useLocale } from './LocaleProvider'

type ToastTone = 'error' | 'success'

type Toast = {
  id: number
  message: string
  tone: ToastTone
}

type ToastContextValue = {
  showToast: (message: string, tone?: ToastTone) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const idRef = useRef(0)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())
  const { t } = useLocale()

  const pauseToast = useCallback((id: number) => {
    clearTimeout(timers.current.get(id))
    timers.current.delete(id)
  }, [])

  const dismissToast = useCallback((id: number) => {
    pauseToast(id)
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [pauseToast])

  const scheduleDismiss = useCallback((id: number) => {
    pauseToast(id)
    timers.current.set(id, setTimeout(() => dismissToast(id), 6000))
  }, [dismissToast, pauseToast])

  useEffect(() => {
    const pendingTimers = timers.current
    return () => { for (const timer of pendingTimers.values()) clearTimeout(timer) }
  }, [])

  const showToast = useCallback(
    (message: string, tone: ToastTone = 'success') => {
      const id = idRef.current + 1
      idRef.current = id

      setToasts((current) => [...current.filter(toast => toast.message !== message && (tone === 'error' || toast.tone === 'success')), { id, message, tone }].slice(-3))
      // Errors need time to read and act on; dismiss them explicitly.
      if (tone === 'success') scheduleDismiss(id)
    },
    [scheduleDismiss]
  )

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-[calc(7rem+env(safe-area-inset-bottom))] z-[1100] ml-auto flex max-h-[60dvh] max-w-sm flex-col gap-3 overflow-y-auto md:bottom-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.tone === 'error' ? 'alert' : 'status'}
            aria-atomic="true"
            onMouseEnter={() => pauseToast(toast.id)}
            onMouseLeave={(event) => { if (toast.tone === 'success' && !event.currentTarget.contains(document.activeElement)) scheduleDismiss(toast.id) }}
            onFocusCapture={() => pauseToast(toast.id)}
            onBlurCapture={(event) => { if (toast.tone === 'success' && !event.currentTarget.contains(event.relatedTarget as Node | null)) scheduleDismiss(toast.id) }}
            className={`pointer-events-auto rounded-xl border px-4 py-3 shadow-2xl backdrop-blur ${
              toast.tone === 'success'
                ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-100'
                : 'border-red-400/30 bg-red-500/15 text-red-100'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 break-words text-sm">{toast.message}</p>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="-my-1 -mr-1 flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl text-sm text-white/80 transition hover:bg-white/10 hover:text-white"
                aria-label={t('common.dismissNotification')}
              >
                X
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }

  return context
}
