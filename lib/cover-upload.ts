'use client'

import { prepareCoverUploadAction } from '../app/actions/storage'
import { getCoverUploadErrorMessage, MEDIA_COVERS_BUCKET, validateCoverFile } from './storage'

export async function uploadCoverFile(file: File) {
  const error = validateCoverFile(file)
  if (error) return { success: false, error, url: null }
  const prepared = await prepareCoverUploadAction({ size: file.size, type: file.type })
  if (!prepared.data) return { success: false, error: prepared.error, url: null }
  const { supabaseBrowser } = await import('./supabase/client')
  const { path, token, url } = prepared.data
  const uploaded = await supabaseBrowser.storage.from(MEDIA_COVERS_BUCKET)
    .uploadToSignedUrl(path, token, file, { contentType: file.type, cacheControl: '3600' })
  return uploaded.error
    ? { success: false, error: getCoverUploadErrorMessage(uploaded.error.message), url: null }
    : { success: true, error: null, url }
}
