'use client'

import { Sparkles } from 'lucide-react'
import { FormEvent, ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { createItemAction } from '../app/actions/items'
import { uploadCoverAction } from '../app/actions/storage'
import { OPEN_ADD_MODAL_EVENT, type OpenAddModalDetail } from '../lib/add-modal-events'
import type { CatalogSearchCandidate } from '../lib/catalog-types'
import { formatExternalRatingValue, normalizeMediaItemInput, type MediaItemInput } from '../lib/media'
import { buildQuickImportDraft } from '../lib/quick-import-draft'
import { mapMediaTypeToCatalogSearchType } from '../lib/search-safety'
import { useLocale } from './LocaleProvider'
import MediaItemForm from './MediaItemForm'
import ModalFrame from './ModalFrame'
import { useToast } from './ToastProvider'

const initialFormState: MediaItemInput = {
  completedAt: '',
  externalRatingLabel: '',
  externalRatingValue: '',
  favorite: false,
  genres: '',
  imageUrl: '',
  notes: '',
  progress: '',
  rating: '',
  startedAt: '',
  status: '',
  title: '',
  totalProgress: '',
  type: '',
}

type QuickImportFormData = Pick<
  MediaItemInput,
  | 'externalRatingLabel'
  | 'externalRatingValue'
  | 'genres'
  | 'imageUrl'
  | 'notes'
  | 'status'
  | 'title'
  | 'totalProgress'
  | 'type'
>

type QuickImportResponseData = {
  candidates?: CatalogSearchCandidate[]
  form: QuickImportFormData
  warning?: string | null
}

type AddModalProps = {
  listenForExternalOpen?: boolean
  triggerClassName?: string
  triggerContent?: ReactNode
}

export default function AddModal({
  listenForExternalOpen = false,
  triggerClassName,
  triggerContent,
}: AddModalProps) {
  const router = useRouter()
  const { locale, t } = useLocale()
  const { showToast } = useToast()
  const titleSearchSkipRef = useRef(false)
  const titleSearchRequestIdRef = useRef(0)

  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [form, setForm] = useState<MediaItemInput>(initialFormState)
  const [isOpen, setIsOpen] = useState(false)
  const [isQuickImporting, setIsQuickImporting] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isTitleSearchLoading, setIsTitleSearchLoading] = useState(false)
  const [quickImportCandidates, setQuickImportCandidates] = useState<CatalogSearchCandidate[]>([])
  const [quickImportMessage, setQuickImportMessage] = useState('')
  const [quickImportTone, setQuickImportTone] = useState<'error' | 'success' | null>(null)
  const [quickImportUrl, setQuickImportUrl] = useState('')
  const [titleSuggestions, setTitleSuggestions] = useState<CatalogSearchCandidate[]>([])
  const [titleSearchError, setTitleSearchError] = useState('')

  const quickImportPlaceholder = 'https://any-site.com/title-page.html'

  const resetState = useCallback(() => {
    titleSearchRequestIdRef.current += 1
    setCoverFile(null)
    setErrorMessage('')
    setForm(initialFormState)
    setIsQuickImporting(false)
    setIsSubmitting(false)
    setIsTitleSearchLoading(false)
    setQuickImportCandidates([])
    setQuickImportMessage('')
    setQuickImportTone(null)
    setQuickImportUrl('')
    setTitleSuggestions([])
    setTitleSearchError('')
  }, [])

  function openModal() {
    setErrorMessage('')
    setIsOpen(true)
  }

  function closeModal() {
    if (isSubmitting) {
      return
    }

    setIsOpen(false)
    resetState()
  }

  function updateField<K extends keyof MediaItemInput>(field: K, value: MediaItemInput[K]) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function applyResolvedForm(data: QuickImportFormData) {
    titleSearchSkipRef.current = true
    titleSearchRequestIdRef.current += 1
    setForm({
      ...initialFormState,
      externalRatingLabel: data.externalRatingLabel,
      externalRatingValue: data.externalRatingValue,
      genres: data.genres,
      imageUrl: data.imageUrl,
      notes: data.notes,
      status: data.status,
      title: data.title,
      totalProgress: data.totalProgress,
      type: data.type,
    })
    setTitleSuggestions([])
  }

  function applyCatalogCandidate(candidate: CatalogSearchCandidate) {
    titleSearchSkipRef.current = true
    titleSearchRequestIdRef.current += 1
    setForm({
      ...initialFormState,
      externalRatingLabel: candidate.externalRatingLabel ?? '',
      externalRatingValue:
        typeof candidate.externalRatingValue === 'number'
          ? String(candidate.externalRatingValue)
          : '',
      genres: candidate.genres,
      imageUrl: candidate.imageUrl,
      notes: candidate.description || '',
      status: candidate.status,
      title: candidate.title,
      totalProgress: candidate.totalProgress,
      type: candidate.type,
    })
    setTitleSuggestions([])
    setTitleSearchError('')
    setIsTitleSearchLoading(false)
    setQuickImportCandidates([])
    setQuickImportMessage('Best match applied. Review the details and save when ready.')
    setQuickImportTone('success')
    setCoverFile(null)
    setIsOpen(true)
  }

  function getCandidateRatingCopy(candidate: CatalogSearchCandidate) {
    if (!candidate.externalRatingLabel || typeof candidate.externalRatingValue !== 'number') {
      return null
    }

    return formatExternalRatingValue(candidate.externalRatingLabel, candidate.externalRatingValue)
  }

  const fetchCatalogSuggestions = useCallback(async (query: string, type: string, signal: AbortSignal) => {
    const response = await fetch('/api/catalog-search', {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ locale, query, type }),
    })

    const payload = (await response.json()) as {
      data?: CatalogSearchCandidate[]
      error?: string
    }

    if (!response.ok) {
      throw new Error(payload.error ?? 'Search failed.')
    }

    return payload.data ?? []
  }, [locale])

  useEffect(() => {
    if (!listenForExternalOpen) {
      return
    }

    function handleExternalOpen(event: Event) {
      const customEvent = event as CustomEvent<OpenAddModalDetail>
      const candidate = customEvent.detail?.candidate
      setIsOpen(true)

      if (candidate) {
        applyCatalogCandidate(candidate)
      }
    }

    window.addEventListener(OPEN_ADD_MODAL_EVENT, handleExternalOpen as EventListener)
    return () =>
      window.removeEventListener(OPEN_ADD_MODAL_EVENT, handleExternalOpen as EventListener)
  }, [listenForExternalOpen])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    if (titleSearchSkipRef.current) {
      titleSearchSkipRef.current = false
      return
    }

    const query = form.title.trim()
    const searchType = mapMediaTypeToCatalogSearchType(form.type)

    if (!searchType || query.length < 2) {
      titleSearchRequestIdRef.current += 1
      setTitleSuggestions([])
      setIsTitleSearchLoading(false)
      setTitleSearchError('')
      return
    }

    const requestId = titleSearchRequestIdRef.current + 1
    titleSearchRequestIdRef.current = requestId
    const controller = new AbortController()

    setIsTitleSearchLoading(true)
    setTitleSearchError('')
    setTitleSuggestions([])

    const timeoutId = window.setTimeout(async () => {
      try {
        const suggestions = await fetchCatalogSuggestions(query, searchType, controller.signal)

        if (titleSearchRequestIdRef.current !== requestId) {
          return
        }

        setTitleSuggestions(suggestions)
      } catch (error) {
        if (
          controller.signal.aborted ||
          titleSearchRequestIdRef.current !== requestId ||
          (error instanceof Error && error.name === 'AbortError')
        ) {
          return
        }

        setTitleSuggestions([])
        setTitleSearchError(
          error instanceof Error ? error.message : 'No safe matches were found for this title.'
        )
      } finally {
        if (controller.signal.aborted || titleSearchRequestIdRef.current !== requestId) {
          return
        }

        setIsTitleSearchLoading(false)
      }
    }, 260)

    return () => {
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [fetchCatalogSuggestions, form.title, form.type, isOpen])

  async function fetchServerQuickImport(url: string): Promise<QuickImportResponseData> {
    const response = await fetch('/api/quick-import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ locale, url }),
    })

    const payload = (await response.json()) as {
      data?: QuickImportResponseData
      error?: string
    }

    if (!response.ok || !payload.data) {
      throw new Error(payload.error ?? 'Quick import failed.')
    }

    return payload.data
  }

  function applyOptimisticDraft(rawUrl: string) {
    const draft = buildQuickImportDraft(rawUrl)

    if (!draft) {
      return null
    }

    applyResolvedForm(draft.form)
    setCoverFile(null)
    return draft
  }

  function applyResolvedQuickImport(data: QuickImportResponseData) {
    applyResolvedForm(data.form)
    setCoverFile(null)
    setQuickImportCandidates(data.candidates ?? [])

    const hasStrongMetadata =
      Boolean(data.form.imageUrl) ||
      Boolean(data.form.totalProgress) ||
      Boolean(data.form.genres) ||
      (data.candidates?.length ?? 0) > 0

    if (data.warning && !hasStrongMetadata) {
      setQuickImportMessage(data.warning)
      setQuickImportTone('error')
      showToast(data.warning, 'error')
      return
    }

    setQuickImportMessage('Quick import completed. Review the details and save when ready.')
    setQuickImportTone('success')
    showToast('Quick import completed.')
  }

  async function runQuickImport(rawUrl: string) {
    const url = rawUrl.trim()

    if (!url) {
      setQuickImportCandidates([])
      setQuickImportMessage('Paste a link first.')
      setQuickImportTone('error')
      return
    }

    setIsQuickImporting(true)
    setQuickImportCandidates([])
    setQuickImportMessage('')
    setQuickImportTone(null)
    setErrorMessage('')
    setQuickImportUrl(url)

    try {
      applyOptimisticDraft(url)
      setQuickImportMessage('Scanning link...')
      setQuickImportTone('success')

      const resolvedImport = await fetchServerQuickImport(url)
      applyResolvedQuickImport(resolvedImport)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Quick import failed.'
      const draft = applyOptimisticDraft(url)
      setQuickImportCandidates([])

      if (draft) {
        setQuickImportMessage(draft.warning)
        setQuickImportTone('error')
        showToast(draft.warning, 'error')
      } else {
        setQuickImportMessage(message)
        setQuickImportTone('error')
        showToast(message, 'error')
      }
    } finally {
      setIsQuickImporting(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const normalized = normalizeMediaItemInput(form)
    if (normalized.error) {
      setErrorMessage(normalized.error)
      return
    }

    setIsSubmitting(true)
    setErrorMessage('')

    let imageUrl = form.imageUrl

    if (coverFile) {
      const uploadFormData = new FormData()
      uploadFormData.set('cover', coverFile)
      const uploadResult = await uploadCoverAction(uploadFormData)

      if (!uploadResult.success || !uploadResult.url) {
        setIsSubmitting(false)
        setErrorMessage(uploadResult.error ?? 'Failed to upload cover image.')
        showToast(uploadResult.error ?? 'Failed to upload cover image.', 'error')
        return
      }

      imageUrl = uploadResult.url
    }

    const payload = {
      ...form,
      imageUrl,
      notes: form.notes,
    }

    const result = await createItemAction(payload)

    setIsSubmitting(false)

    if (!result.success) {
      setErrorMessage(result.error ?? 'Failed to save item.')
      showToast(result.error ?? 'Failed to save item.', 'error')
      return
    }

    closeModal()
    showToast('Item added to your vault.')
    router.refresh()
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className={
          triggerClassName ??
          'min-h-11 rounded-full border border-blue-300/20 bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_24px_rgba(59,130,246,0.28)] transition-all duration-300 hover:bg-blue-400'
        }
      >
        {triggerContent ?? '+ Add New'}
      </button>

      <ModalFrame
        isOpen={isOpen}
        onClose={closeModal}
        title="Add New Entry"
        description="Save a new anime, manga, movie, or book to your vault."
      >
        <section className="border-b border-slate-800 px-6 py-5">
          <div className="rounded-3xl border border-blue-500/20 bg-blue-500/10 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-200/80">
                  <span className="inline-flex items-center gap-2">
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    Quick Import
                  </span>
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  Paste any link and let the app prefill the form.
                </p>
              </div>
              {isQuickImporting ? (
                <div className="mt-1 h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-blue-200/30 border-t-blue-300" />
              ) : null}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
              <div className="sm:col-span-full">
                <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                  Quick Import Link
                </p>
              </div>
              <input
                type="url"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={quickImportUrl}
                onChange={(event) => setQuickImportUrl(event.target.value)}
                onPaste={(event) => {
                  event.preventDefault()
                  const pastedUrl = event.clipboardData.getData('text')
                  setQuickImportUrl(pastedUrl)
                  void runQuickImport(pastedUrl)
                }}
                placeholder={quickImportPlaceholder}
                className="min-h-14 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-base text-white outline-none transition focus:border-blue-400"
                disabled={isSubmitting || isQuickImporting}
              />

              <button
                type="button"
                onClick={() => void runQuickImport(quickImportUrl)}
                disabled={isSubmitting || isQuickImporting}
                className="min-h-14 rounded-2xl bg-blue-600 px-5 py-3 text-base font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <span className="inline-flex items-center justify-center gap-2">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  {isQuickImporting ? 'Scanning Link...' : 'Import Link'}
                </span>
              </button>
            </div>

            {quickImportMessage ? (
              <p
                className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                  quickImportTone === 'success'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-100'
                }`}
              >
                {quickImportMessage}
              </p>
            ) : null}

            {quickImportCandidates.length > 0 ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                <div className="mb-3">
                  <p className="text-sm font-semibold text-white">Possible matches</p>
                  <p className="mt-1 text-xs text-slate-400">
                    If the automatic guess was not exact, tap the closest result below.
                  </p>
                </div>

                <div className="grid gap-3">
                  {quickImportCandidates.map((candidate) => (
                    <button
                      key={candidate.id}
                      type="button"
                      onClick={() => applyCatalogCandidate(candidate)}
                      className="flex min-h-14 items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-left transition hover:border-blue-400/40 hover:bg-slate-900"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{candidate.title}</p>
                        <p className="mt-1 truncate text-xs text-slate-400">
                          {[candidate.provider, candidate.subtitle, candidate.year]
                            .filter(Boolean)
                            .join(' / ')}
                        </p>
                        {getCandidateRatingCopy(candidate) ? (
                          <p className="mt-1 text-[11px] font-medium text-blue-200">
                            {getCandidateRatingCopy(candidate)}
                          </p>
                        ) : null}
                        {candidate.totalProgress ? (
                          <p className="mt-1 text-[11px] text-slate-500">
                            {candidate.type === 'Anime' || candidate.type === 'TV Series'
                              ? `Episodes: ${candidate.totalProgress}`
                              : `Pages/Chapters: ${candidate.totalProgress}`}
                          </p>
                        ) : null}
                      </div>
                      <span className="shrink-0 rounded-full border border-blue-400/20 px-3 py-1 text-xs font-medium text-blue-100">
                        Use this
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <MediaItemForm
          coverFileName={coverFile?.name}
          errorMessage={errorMessage}
          form={form}
          isSubmitting={isSubmitting || isQuickImporting}
          onChange={updateField}
          onClearCoverFile={() => setCoverFile(null)}
          onCoverFileChange={setCoverFile}
          onSelectTitleSuggestion={applyCatalogCandidate}
          onSubmit={handleSubmit}
          onTitleInputChange={() => {
            setQuickImportCandidates([])
            setQuickImportMessage('')
            setQuickImportTone(null)
            setTitleSearchError('')
          }}
          submitLabel={t('common.saveItem')}
          titleSuggestions={titleSuggestions}
          titleSuggestionsError={titleSearchError}
          titleSuggestionsLoading={isTitleSearchLoading}
        />
      </ModalFrame>
    </>
  )
}


