'use server'

import { randomUUID } from 'node:crypto'

import { requireCurrentUser } from '../../lib/auth/dal'
import {
  ALLOWED_COVER_MIME_TYPES,
  getCoverUploadErrorMessage,
  MAX_COVER_FILE_SIZE,
  MEDIA_COVERS_BUCKET,
} from '../../lib/storage'
import { createSupabaseServerClient } from '../../lib/supabase/server'

type UploadCoverResult = {
  error: string | null
  success: boolean
  url: string | null
}

function getFileExtension(file: File) {
  const fromName = file.name.split('.').pop()?.trim().toLowerCase()
  if (fromName) {
    return fromName
  }

  switch (file.type) {
    case 'image/png':
      return 'png'
    case 'image/webp':
      return 'webp'
    case 'image/gif':
      return 'gif'
    case 'image/jpeg':
    default:
      return 'jpg'
  }
}

export async function uploadCoverAction(formData: FormData): Promise<UploadCoverResult> {
  const file = formData.get('cover')

  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Choose an image file first.', success: false, url: null }
  }

  if (file.size > MAX_COVER_FILE_SIZE) {
    return {
      error: 'Cover image must be 5 MB or smaller.',
      success: false,
      url: null,
    }
  }

  if (!ALLOWED_COVER_MIME_TYPES.includes(file.type as (typeof ALLOWED_COVER_MIME_TYPES)[number])) {
    return {
      error: 'Only JPG, PNG, WEBP, and GIF covers are supported.',
      success: false,
      url: null,
    }
  }

  const user = await requireCurrentUser()
  const supabase = createSupabaseServerClient(user.accessToken)
  const filePath = `${user.id}/${Date.now()}-${randomUUID()}.${getFileExtension(file)}`
  const uploaded = await supabase.storage.from(MEDIA_COVERS_BUCKET).upload(filePath, file, {
    cacheControl: '3600',
    contentType: file.type,
    upsert: false,
  })

  if (uploaded.error) {
    return {
      error: getCoverUploadErrorMessage(uploaded.error.message),
      success: false,
      url: null,
    }
  }

  const { data } = supabase.storage.from(MEDIA_COVERS_BUCKET).getPublicUrl(filePath)

  return {
    error: null,
    success: true,
    url: data.publicUrl,
  }
}
