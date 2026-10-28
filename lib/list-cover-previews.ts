export type ListCoverPreviewRow = { list_id?: string | null; items?: unknown }

export function getListCoverPreviews(rows: readonly ListCoverPreviewRow[], userId: string) {
  const previews = new Map<string, string[]>()
  for (const row of rows) {
    if (!row.list_id) continue
    const item: unknown = Array.isArray(row.items) ? row.items[0] : row.items
    if (!item || typeof item !== 'object' || !('user_id' in item) || item.user_id !== userId
      || !('image_url' in item) || typeof item.image_url !== 'string') continue
    const url = item.image_url.trim()
    if (!/^https?:\/\//i.test(url) && !/^\/(?!\/)/.test(url)) continue
    const covers = previews.get(row.list_id) ?? []
    if (covers.length < 4 && !covers.includes(url)) covers.push(url)
    previews.set(row.list_id, covers)
  }
  return previews
}
