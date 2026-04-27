'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

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
  const dismissLabel = 'Dismiss notification'

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback(
    (message: string, tone: ToastTone = 'success') => {
      const id = idRef.current + 1
      idRef.current = id

      setToasts((current) => [...current, { id, message, tone }])
      window.setTimeout(() => {
        dismissToast(id)
      }, 3500)
    },
    [dismissToast]
  )

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-[70] flex w-full max-w-sm flex-col gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur ${
              toast.tone === 'success'
                ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-100'
                : 'border-red-400/30 bg-red-500/15 text-red-100'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm">{toast.message}</p>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="rounded-full px-2 py-0.5 text-xs text-white/70 transition hover:bg-white/10 hover:text-white"
                aria-label={dismissLabel}
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
