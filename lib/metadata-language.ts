/** Presentation preferences only. Never use these values to rewrite library records. */
export const metadataLanguages = ['ru', 'en', 'original'] as const
export type MetadataLanguage = (typeof metadataLanguages)[number]
export const metadataLanguageCookieName = 'media-vault-metadata-language'
export function isMetadataLanguage(value: unknown): value is MetadataLanguage {
  return value === 'ru' || value === 'en' || value === 'original'
}
export function resolveMetadataLanguage(value: unknown): MetadataLanguage {
  return isMetadataLanguage(value) ? value : 'en'
}
export function tmdbLanguage(value: MetadataLanguage) {
  return value === 'ru' ? 'ru-RU' : 'en-US'
}
