'use server'

import { randomUUID } from 'node:crypto'
import { requireCurrentUser } from '../../lib/auth/dal'
import { getCoverUploadErrorMessage, MEDIA_COVERS_BUCKET, validateCoverFile } from '../../lib/storage'
import { createSupabaseServerClient } from '../../lib/supabase/server'

// Only small metadata crosses the Server Action. Bytes go straight to Storage,
// avoiding Next's 1 MB action limit and Vercel's function request limit.
export async function prepareCoverUploadAction(file: { size: number; type: string }) {
  const user = await requireCurrentUser()
  const error = file && typeof file.type === 'string' ? validateCoverFile(file) : 'Choose an image file first.'
  if (error) return { error, data: null }
  const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[file.type]
  const path = `${user.id}/${Date.now()}-${randomUUID()}.${extension}`
  const bucket = createSupabaseServerClient(user.accessToken).storage.from(MEDIA_COVERS_BUCKET)
  const signed = await bucket.createSignedUploadUrl(path, { upsert: false })
  if (signed.error || !signed.data) return { error: getCoverUploadErrorMessage(signed.error?.message), data: null }
  return { error: null, data: { path, token: signed.data.token, url: bucket.getPublicUrl(path).data.publicUrl } }
}
