type DeleteResult = { success: boolean; deleted: number; failed: number; deletedIds?: readonly string[] }

export function getConfirmedDeletedIds(result: DeleteResult, requestedIds: readonly string[]) {
  const requested = new Set(requestedIds)
  if (Array.isArray(result.deletedIds)) {
    return new Set(result.deletedIds.filter((id) => requested.has(id)))
  }
  // Older deployments returned counts only. A partial count cannot identify rows.
  return result.success && result.failed === 0 && result.deleted === requested.size ? requested : new Set<string>()
}
