'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import { getRelatedDiscoverHref, type RelatedTitle } from '../../lib/related-titles'
import CoverPlaceholder from '../CoverPlaceholder'

export default function RelatedTitles({ titles }: { titles: RelatedTitle[] }) {
  const [expanded, setExpanded] = useState(false)
  if (!titles.length) return <p className="text-xs leading-5 text-slate-400">No linked titles were returned for this title.</p>
  const visible = expanded ? titles : titles.slice(0, 6)
  return <section className="min-w-0 space-y-3 border-t border-slate-800 pt-4" aria-label="Related titles">
    <div><h3 className="text-sm font-semibold text-slate-100">Related titles</h3>
      <p className="mt-1 text-xs leading-5 text-slate-400">Connections from AniList, not a complete watch order. Search Discover to preview and add a title; nothing is added automatically.</p>
    </div>
    <div className="grid min-w-0 gap-3 md:grid-cols-2">
      {visible.map((title) => {
        const href = getRelatedDiscoverHref(title)
        return <article key={title.id} className="flex min-w-0 items-start gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3">
          <div className="relative h-[84px] w-14 shrink-0 overflow-hidden rounded-xl bg-slate-900">
            {title.coverUrl ? <Image unoptimized src={title.coverUrl} alt="" fill sizes="56px" className="object-cover" /> : <CoverPlaceholder compact title={title.title} type={title.type} />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-blue-200">{title.relation} / {title.type}</p>
            <a href={title.url} target="_blank" rel="noopener noreferrer" className="mt-1 block break-words rounded-xl text-sm font-semibold leading-5 text-slate-100 hover:text-blue-200 focus-visible:outline-2 focus-visible:outline-blue-400">{title.title}</a>
            {href ? <Link href={href} className="mt-2 inline-flex min-h-11 items-center rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold text-blue-200 hover:border-blue-400 focus-visible:outline-2 focus-visible:outline-blue-400">Search in Discover</Link> : null}
          </div>
        </article>
      })}
    </div>
    {titles.length > 6 ? <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)} className="min-h-11 rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-blue-200">{expanded ? 'Show fewer related titles' : `Show all ${titles.length} related titles`}</button> : null}
    <p className="text-xs leading-5 text-slate-500">Up to 24 non-adult connections are shown. Open AniList for the full relation graph.</p>
  </section>
}
