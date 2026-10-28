'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useLocale } from './LocaleProvider'

export default function RecommendationCarousel({ children, itemCount }: { children: ReactNode; itemCount: number }) {
  const { t } = useLocale()
  const viewportRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: number; x: number; y: number; left: number; moved: boolean } | null>(null)
  const suppressClick = useRef(false)
  const [isDragging, setIsDragging] = useState(false)
  const [edges, setEdges] = useState({ previous: false, next: false })
  const viewportId = useId()
  const helpId = useId()

  const measure = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const next = { previous: viewport.scrollLeft > 1, next: viewport.scrollWidth - viewport.clientWidth - viewport.scrollLeft > 1 }
    setEdges(current => current.previous === next.previous && current.next === next.next ? current : next)
  }, [])

  useEffect(() => {
    const frame = requestAnimationFrame(measure)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    if (viewportRef.current) observer?.observe(viewportRef.current)
    if (contentRef.current) observer?.observe(contentRef.current)
    return () => { cancelAnimationFrame(frame); observer?.disconnect() }
  }, [itemCount, measure])

  function scroll(direction: number, edge?: 'start' | 'end') {
    const viewport = viewportRef.current
    if (!viewport) return
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    const left = edge === 'start' ? 0 : edge === 'end' ? viewport.scrollWidth - viewport.clientWidth : viewport.scrollLeft + direction * Math.max(200, viewport.clientWidth * 0.8)
    viewport.scrollTo({ left, behavior })
  }

  function finishDrag() {
    drag.current = null
    setIsDragging(false)
  }

  return (
    <div className="min-w-0 space-y-2" role="region" aria-label={t('library.recommended')}>
      <div className="flex justify-end gap-2">
        <button type="button" aria-label={t('carousel.previous')} aria-controls={viewportId} disabled={!edges.previous} onClick={() => scroll(-1)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 text-slate-100 transition hover:border-violet-400/50 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-35">
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <button type="button" aria-label={t('carousel.next')} aria-controls={viewportId} disabled={!edges.next} onClick={() => scroll(1)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 text-slate-100 transition hover:border-violet-400/50 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-35">
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <p id={helpId} className="sr-only">{t('carousel.help')}</p>
      <div
        ref={viewportRef}
        id={viewportId}
        tabIndex={0}
        role="group"
        aria-label={t('carousel.items')}
        aria-describedby={helpId}
        className={`scrollbar-hide min-w-0 overflow-x-auto rounded-xl pb-2 ${isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
        onScroll={measure}
        onKeyDown={event => {
          if (event.target !== event.currentTarget) return
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) return
          event.preventDefault()
          scroll(event.key === 'ArrowLeft' || event.key === 'PageUp' ? -1 : 1, event.key === 'Home' ? 'start' : event.key === 'End' ? 'end' : undefined)
        }}
        onPointerDown={event => {
          if (event.button !== 0 || !event.isPrimary) return
          suppressClick.current = false
          if (event.pointerType !== 'mouse' || (event.target as Element).closest('[role="dialog"]')) return
          drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, left: event.currentTarget.scrollLeft, moved: false }
        }}
        onPointerMove={event => {
          const active = drag.current
          if (!active || active.id !== event.pointerId) return
          const distance = event.clientX - active.x
          if (!active.moved) {
            if (Math.abs(distance) < 6 || Math.abs(distance) <= Math.abs(event.clientY - active.y)) return
            active.moved = true
            suppressClick.current = true
            event.currentTarget.setPointerCapture(event.pointerId)
            setIsDragging(true)
          }
          event.preventDefault()
          event.currentTarget.scrollLeft = active.left - distance
        }}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onLostPointerCapture={finishDrag}
        onPointerLeave={() => { if (!drag.current?.moved) finishDrag() }}
        onDragStart={event => { if (drag.current) event.preventDefault() }}
        onClickCapture={event => {
          if (!suppressClick.current || event.detail === 0) return
          event.preventDefault()
          event.stopPropagation()
          suppressClick.current = false
        }}
      >
        <div ref={contentRef} className="flex w-max min-w-full gap-3 md:gap-4">{children}</div>
      </div>
    </div>
  )
}
