import { readFileSync, readdirSync } from 'node:fs'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const displayAttributes = new Set(['title', 'description', 'label', 'placeholder', 'aria-label', 'ariaLabel', 'emptyLabel', 'kicker', 'eyebrow', 'alt', 'message', 'emptyMessage', 'confirmLabel', 'cancelLabel', 'subtitle'])
const technicalText = new Set(['MV', 'Vault', 'Media Vault', 'AniList', 'MyAnimeList', 'MAL ID:', '| Jikan:', 'JSON', 'English', 'you@example.com', 'e.g. anilist_user', 'favorites-or-watchlist', 'your-name', 'YYYY-MM-DD', 'https://...', '/lists/'])
function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(`${directory}/${entry.name}`) : entry.name.endsWith('.tsx') ? [`${directory}/${entry.name}`] : [])
}
describe('UI localization coverage guard', () => {
  it('keeps static human-facing JSX copy in the dictionaries, apart from brands and technical examples', () => {
    const missed: string[] = []
    for (const file of [...files('app'), ...files('components')]) {
      if (file.includes('/qa-localization/')) continue
      const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
      const check = (text: string) => {
        text = text.replace(/\s+/g, ' ').trim()
        if (/[A-Za-z]{2}/.test(text) && !technicalText.has(text) && !text.startsWith('supabase/') && !text.startsWith('NEXT_PUBLIC_SITE_URL=')) missed.push(`${file}: ${text}`)
      }
      const visit = (node: ts.Node) => {
        if (ts.isJsxText(node)) check(node.text)
        if (ts.isJsxAttribute(node) && displayAttributes.has(node.name.getText(source)) && node.initializer && ts.isStringLiteral(node.initializer)) check(node.initializer.text)
        ts.forEachChild(node, visit)
      }
      visit(source)
    }
    expect(missed).toEqual([])
  })
})
