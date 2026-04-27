'use client'

import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

type ModalFrameProps = {
  children: ReactNode
  description: string
  isOpen: boolean
  onClose: () => void
  title: string
}

export default function ModalFrame({
  children,
  description,
  isOpen,
  onClose,
  title,
}: ModalFrameProps) {
  useEffect(() => {
    if (!isOpen) {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (typeof window === 'undefined' || !isOpen) {
    return null
  }

  return createPortal(
    <div
      className="safe-top safe-bottom fixed inset-0 z-[1000] overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),_transparent_30%),rgba(2,6,23,0.82)] px-4 py-6 backdrop-blur-sm sm:px-6 sm:py-10"
      onClick={onClose}
    >
      <div className="flex min-h-full items-start justify-center">
        <div
          className="glass-panel surface-highlight flex w-full max-w-3xl flex-col overflow-hidden rounded-[30px]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-200/75">
                Quick Capture
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">{title}</h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">{description}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex min-h-12 min-w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
              aria-label="Close modal"
            >
              X
            </button>
          </div>

          <div className="max-h-[calc(100dvh-6rem)] overflow-y-auto pb-32 md:pb-8">
            {children}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
