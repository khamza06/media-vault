import { describe, expect, it } from 'vitest'
import { formatDateForLocale, getMessages, isLocale, resolveLocale, t, translateStatus, translateType } from '../lib/i18n'
import { mediaStatuses, mediaTypes } from '../lib/media'

describe('English/Russian display dictionaries', () => {
  it('restores valid Russian text and keeps every English key/placeholder', () => {
    const en = getMessages('en'); const ru = getMessages('ru')
    expect(Object.keys(ru).sort()).toEqual(Object.keys(en).sort())
    expect(ru['nav.library']).toBe('Библиотека')
    expect(ru['form.notes']).toBe('Заметки')
    expect(t('ru', 'toast.itemUpdated', { title: 'Fixture' })).toContain('Fixture')
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect([...ru[key].matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort()).toEqual([...en[key].matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort())
      expect(ru[key]).not.toMatch(/[\u0080-\u009f\ufffd]/)
    }
  })
  it('only accepts supported exact locale codes', () => {
    expect(isLocale('ru')).toBe(true)
    expect(resolveLocale('en')).toBe('en')
    for (const value of ['RU', 'ru-RU', 'javascript:ru', undefined, null]) expect(resolveLocale(value)).toBe('en')
  })
  it('translates display labels without changing stored type/status values', () => {
    expect(translateStatus('ru', 'Re-Watching')).toBe('Пересматриваю')
    expect(translateType('ru', 'Manga')).toBe('Манга')
    expect(mediaStatuses).toContain('Completed')
    expect(mediaTypes).toContain('TV Series')
    expect(translateStatus('ru', 'custom')).toBe('custom')
  })
  it('handles invalid dates gracefully and respects the requested date locale', () => {
    expect(formatDateForLocale('ru', 'bad')).toBe('Неизвестно')
    expect(formatDateForLocale('en', null)).toBe('Unknown')
    expect(formatDateForLocale('ru', '2026-10-28T12:00:00Z')).toContain('2026')
  })
})
