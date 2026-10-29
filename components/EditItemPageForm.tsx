'use client'
import { translateError } from '../lib/ui-i18n'


import { FormEvent, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { updateItemAction } from '../app/actions/items'
import { uploadCoverFile } from '../lib/cover-upload'
import { useLocale } from './LocaleProvider'
import type { MediaItem, MediaItemInput } from '../lib/media'
import { normalizeMediaItemInput } from '../lib/media'
import MediaItemForm from './MediaItemForm'
import { useToast } from './ToastProvider'

type EditItemPageFormProps = {
  item: MediaItem
  returnTo: string
}

function createFormState(item: MediaItem): MediaItemInput {
  return {
    completedAt: item.completedAt ?? '',
    externalRatingLabel: item.externalRatingLabel ?? '',
    externalRatingValue:
      typeof item.externalRatingValue === 'number' ? String(item.externalRatingValue) : '',
    favorite: item.favorite,
    genres: item.genres.join(', '),
    title: item.title,
    type: item.type,
    status: item.status,
    progress: item.progress > 0 ? String(item.progress) : '',
    totalProgress: item.totalProgress ? String(item.totalProgress) : '',
    rating: item.rating ? String(item.rating) : '',
    imageUrl: item.imageUrl ?? '',
    notes: item.notes ?? '',
    startedAt: item.startedAt ?? '',
  }
}

export default function EditItemPageForm({
  item,
  returnTo,
}: EditItemPageFormProps) {
  const router = useRouter()
  const { locale, t  } = useLocale()
  const { showToast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [form, setForm] = useState<MediaItemInput>(() => createFormState(item))
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const uploadedCoverRef = useRef<{ file: File; url: string } | null>(null)
  const submittingRef = useRef(false)

  function updateField<K extends keyof MediaItemInput>(
    field: K,
    value: MediaItemInput[K]
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submittingRef.current) return

    const normalized = normalizeMediaItemInput(form)
    if (normalized.error) {
      setErrorMessage(normalized.error)
      return
    }

    submittingRef.current = true
    setIsSubmitting(true)
    setErrorMessage('')

    try {
      let imageUrl = form.imageUrl

      if (coverFile) {
        const uploadResult = uploadedCoverRef.current?.file === coverFile
          ? { success: true, url: uploadedCoverRef.current.url, error: null }
          : await uploadCoverFile(coverFile)

        if (!uploadResult.success || !uploadResult.url) {
          setErrorMessage(uploadResult.error ?? t('error.uploadCover'))
          showToast(uploadResult.error ?? t('error.uploadCover'), 'error')
          return
        }

        imageUrl = uploadResult.url
        uploadedCoverRef.current = { file: coverFile, url: imageUrl }
      }

      const result = await updateItemAction(
        item.id,
        {
          ...form,
          imageUrl,
          notes: form.notes,
        },
        item.imageUrl
      )

      if (!result.success) {
        setErrorMessage(result.error ?? t('error.updateItem'))
        showToast(result.error ?? t('error.updateItem'), 'error')
        return
      }

      showToast(t('toast.itemUpdated', { title: form.title }))
      router.replace(returnTo)
    } catch {
      setErrorMessage(t('error.updateItem'))
      showToast(t('error.updateItem'), 'error')
    } finally {
      submittingRef.current = false
      setIsSubmitting(false)
    }
  }

  return (
    <section className="glass-panel rounded-xl shadow-[0_30px_80px_rgba(15,23,42,0.45)]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-6 py-5 sm:px-7">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-slate-400">{t('edit.title')}</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">{item.title}</h1>
        </div>
        <Link
          href={returnTo}
          className="glass-panel-soft rounded-xl px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-blue-400/40 hover:text-white"
        >
          {t('common.cancel')}
        </Link>
      </div>

      <MediaItemForm
        coverFileName={coverFile?.name}
        errorMessage={translateError(locale, errorMessage)}
        form={form}
        isSubmitting={isSubmitting}
        onChange={updateField}
        onClearCoverFile={() => setCoverFile(null)}
        onCoverFileChange={setCoverFile}
        onSubmit={handleSubmit}
        submitLabel={t('common.saveChanges')}
      />
    </section>
  )
}


