import type { MetadataLanguage } from './metadata-language'

export type TmdbText = {
  title?: string | null; name?: string | null; overview?: string | null
  original_title?: string | null; original_name?: string | null; original_language?: string
  translations?: { translations?: Array<{ iso_639_1: string; data?: { title?: string; name?: string; overview?: string } }> }
}

/** Resolve fields independently; an empty translation never erases a usable synopsis. */
export function localizeTmdbText<T extends TmdbText>(data: T, preference: MetadataLanguage): T {
  const translations = data.translations?.translations ?? []
  const english = translations.find(row => row.iso_639_1 === 'en')?.data
  const target = translations.find(row => row.iso_639_1 === (preference === 'original' ? data.original_language : preference))?.data
  const nonempty = (...values: Array<string | null | undefined>) => values.find(value => value?.trim())?.trim() ?? ''
  const originalTitle = nonempty(data.original_title, data.original_name)
  const title = preference === 'original' ? nonempty(originalTitle, data.title, data.name) : nonempty(target?.title, target?.name, data.title, data.name, english?.title, english?.name, originalTitle)
  const overview = preference === 'original'
    ? nonempty(target?.overview, english?.overview, data.overview)
    : nonempty(target?.overview, data.overview, english?.overview)
  return { ...data, ...(data.title !== undefined ? { title } : { name: title }), overview }
}
