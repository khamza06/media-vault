import { getMessages, type Locale } from './i18n'
import { uiMessages, type UiMessageKey } from './ui-messages'

const englishMessages = getMessages('en')
const russianMessages = getMessages('ru')
const englishByRussian = new Map<string, string>([
  ...Object.entries(uiMessages).map(([english, russian]) => [russian, english] as [string, string]),
  ...Object.entries(englishMessages).map(([key, english]) => [russianMessages[key as keyof typeof russianMessages], english] as [string, string]),
])

const templates = Object.entries(uiMessages).filter(([key]) => /\{\w+\}/.test(key))
  .sort(([a], [b]) => b.replace(/\{\w+\}/g, '').length - a.replace(/\{\w+\}/g, '').length).map(([key, translated]) => {
  const tokens: string[] = []
  const escaped = key.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{(\w+)\}/g, (_, token: string) => { tokens.push(token); return '([\\s\\S]*?)' })
  return { pattern: new RegExp(`^${escaped}$`), tokens, translated }
})

/** English source IDs keep the English experience verbatim and make missing translations testable. */
export function ui(locale: Locale, key: UiMessageKey, vars?: Record<string, string | number>) {
  const message = locale === 'ru' ? uiMessages[key] : key
  return message.replace(/\{(\w+)\}/g, (match, token: string) => String(vars?.[token] ?? match))
    .replace(/&(?:apos|quot|amp|lt|gt|nbsp);/g, entity => ({ '&apos;': "'", '&quot;': '"', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&nbsp;': ' ' }[entity] ?? entity))
}

/** Translate known application errors/labels at the presentation boundary, never user content. */
export function translateMessage(locale: Locale, message: string) {
  // Existing feedback can survive a locale switch. Translate only known app messages.
  if (locale !== 'ru') return englishByRussian.get(message) ?? message
  if (Object.hasOwn(uiMessages, message)) return uiMessages[message as UiMessageKey]
  if (message.length <= 2000) {
    for (const { pattern, tokens, translated } of templates) {
      const match = pattern.exec(message)
      if (match) return translated.replace(/\{(\w+)\}/g, (placeholder, token: string) => {
        const index = tokens.indexOf(token)
        return index < 0 ? placeholder : match[index + 1]
      })
    }
  }
  return message
}

export function translateError(locale: Locale, message: string) {
  const translated = translateMessage(locale, message)
  // Provider/transport diagnostics have an unbounded vocabulary. Keep a localized,
  // actionable message rather than rendering raw upstream errors to the user.
  if (locale === 'ru' && translated === message && /[A-Za-z]{3}/.test(message) && !/[А-Яа-яЁё]/.test(message)) {
    return 'Не удалось выполнить действие. Проверьте введённые данные и подключение и повторите попытку.'
  }
  return translated
}

export function formatNumber(locale: Locale, value: number, maximumFractionDigits = 1) {
  return new Intl.NumberFormat(locale === 'ru' ? 'ru-RU' : 'en-US', { maximumFractionDigits }).format(value)
}

export function countNoun(locale: Locale, count: number, noun: 'item' | 'list' | 'public list') {
  if (locale === 'en') return noun + (count === 1 ? '' : 's')
  const category = new Intl.PluralRules('ru').select(count)
  const index = category === 'one' ? 0 : category === 'few' ? 1 : 2
  return ({ item: ['запись', 'записи', 'записей'], list: ['список', 'списка', 'списков'], 'public list': ['публичный список', 'публичных списка', 'публичных списков'] })[noun][index]
}
