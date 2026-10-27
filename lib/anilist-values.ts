export function normalizeTenPointScore(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 10) {
    return null
  }
  return Math.round(value * 10) / 10
}

export function normalizeAniListAverageScore(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 100) {
    return null
  }
  return Math.round(value) / 10
}

export function normalizeAniListPersonalScore(value: unknown) {
  // The list query explicitly requests POINT_10_DECIMAL; the vault stores integers.
  const score = normalizeTenPointScore(value)
  return score === null ? null : Math.max(1, Math.round(score))
}

export function normalizeImportDate(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) {
    return null
  }
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null
}

export function toCompleteAniListDate(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const date = value as { year?: unknown; month?: unknown; day?: unknown }
  const { year, month, day } = date
  if (typeof year !== 'number' || typeof month !== 'number' || typeof day !== 'number' ||
      !Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day) ||
      year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null
  }
  return normalizeImportDate(`${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
}
