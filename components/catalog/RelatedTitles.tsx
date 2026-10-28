'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import { getRelatedDiscoverHref, type RelatedTitle } from '../../lib/related-titles'
import CoverPlaceholder from '../CoverPlaceholder'
import { useLocale } from '../LocaleProvider'
import { translateType, type MessageKey } from '../../lib/i18n'

const relationKeys = new Map<string, MessageKey>([
  ['Adaptation', 'relation.adaptation'], ['Prequel', 'relation.prequel'], ['Sequel', 'relation.sequel'], ['Parent story', 'relation.parent'],
  ['Side story', 'relation.side'], ['Shared character', 'relation.character'], ['Summary', 'relation.summary'], ['Alternative version', 'relation.alternative'],
  ['Spin-off', 'relation.spinOff'], ['Related', 'relation.other'], ['Source material', 'relation.source'], ['Compilation', 'relation.compilation'],
  ['Contains', 'relation.contains'], ['Same universe', 'relation.universe'],
])

export default function RelatedTitles({ titles }: { titles: RelatedTitle[] }) {
  const [expanded, setExpanded] = useState(false)
  const { locale, t } = useLocale()
  if (!titles.length) return <p className="text-xs leading-5 text-slate-400">{t('related.empty')}</p>
  const visible = expanded ? titles : titles.slice(0, 6)
  return <section className="min-w-0 space-y-3 border-t border-slate-800 pt-4" aria-label={t('related.heading')}>
    <div><h3 className="text-sm font-semibold text-slate-100">{t('related.heading')}</h3>
      <p className="mt-1 text-xs leading-5 text-slate-400">{t('related.hint')}</p>
    </div>
    <div className="grid min-w-0 gap-3 md:grid-cols-2">
      {visible.map((title) => {
        const href = getRelatedDiscoverHref(title)
        const relationKey = relationKeys.get(title.relation)
        return <article key={title.id} className="flex min-w-0 items-start gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3">
          <div className="relative h-[84px] w-14 shrink-0 overflow-hidden rounded-xl bg-slate-900">
            {title.coverUrl ? <Image unoptimized src={title.coverUrl} alt="" fill sizes="56px" className="object-cover" /> : <CoverPlaceholder compact title={title.title} type={title.type} />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-blue-200">{relationKey ? t(relationKey) : title.relation} / {translateType(locale, title.type)}</p>
            <a href={title.url} target="_blank" rel="noopener noreferrer" className="mt-1 block break-words rounded-xl text-sm font-semibold leading-5 text-slate-100 hover:text-blue-200 focus-visible:outline-2 focus-visible:outline-blue-400">{title.title}</a>
            {href ? <Link href={href} className="mt-2 inline-flex min-h-11 items-center rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold text-blue-200 hover:border-blue-400 focus-visible:outline-2 focus-visible:outline-blue-400">{t('related.search')}</Link> : null}
          </div>
        </article>
      })}
    </div>
    {titles.length > 6 ? <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)} className="min-h-11 rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-blue-200">{expanded ? t('related.showFewer') : t('related.showAll', { count: titles.length })}</button> : null}
    <p className="text-xs leading-5 text-slate-500">{t('related.limit')}</p>
  </section>
}
