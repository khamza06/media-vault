export const MEDIA_COVERS_BUCKET = 'media-covers'
export const MAX_COVER_FILE_SIZE = 5 * 1024 * 1024
export const ALLOWED_COVER_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const

export function getPublicCoverPath(url: string) {
  const marker = `/storage/v1/object/public/${MEDIA_COVERS_BUCKET}/`
  const markerIndex = url.indexOf(marker)

  if (markerIndex === -1) {
    return null
  }

  const path = url.slice(markerIndex + marker.length)
  return path.length > 0 ? decodeURIComponent(path) : null
}

export function isOwnedCoverPath(path: string, userId: string) {
  return path.startsWith(`${userId}/`)
}

export function getCoverUploadErrorMessage(message?: string | null) {
  if (!message) {
    return 'Failed to upload cover image.'
  }

  const normalized = message.toLowerCase()

  if (normalized.includes('bucket') && normalized.includes('not found')) {
    return 'Storage bucket is not set up yet. Open Setup and run the storage migration.'
  }

  if (normalized.includes('mime') || normalized.includes('content type')) {
    return 'Only JPG, PNG, WEBP, and GIF covers are supported.'
  }

  return message
}
