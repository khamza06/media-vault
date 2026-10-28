import { BookOpen, Clapperboard, Library, Tv } from 'lucide-react'

type CoverPlaceholderProps = {
  title: string
  type: string
  typeLabel?: string
  compact?: boolean
}

export default function CoverPlaceholder({ title, type, typeLabel = type, compact = false }: CoverPlaceholderProps) {
  const words = title.trim().split(/\s+/).filter(Boolean)
  const initials = words.slice(0, 2).map((word) => Array.from(word)[0]).join('').toLocaleUpperCase() || 'MV'
  const Icon = ['Manga', 'Manhwa', 'Manhua', 'Book'].includes(type)
    ? BookOpen
    : type === 'Movie' ? Clapperboard : ['Anime', 'TV Series'].includes(type) ? Tv : Library

  return (
    <span role="img" aria-label={`${title} cover placeholder`} className="@container flex h-full w-full flex-col items-center justify-center gap-4 bg-[radial-gradient(ellipse_at_top_right,rgba(59,130,246,0.22),transparent_70%),linear-gradient(145deg,#172554,#0f172a_55%,#020617)] p-3 text-center text-blue-100">
      <span aria-hidden="true" className={`font-bold tracking-tight ${compact ? 'text-xl' : 'text-[clamp(1.5rem,22cqi,4rem)]'}`}>{initials}</span>
      {!compact ? <span aria-hidden="true" className="flex items-center gap-2 text-xs font-medium text-blue-200/70"><Icon className="h-4 w-4 shrink-0" />{typeLabel}</span> : null}
    </span>
  )
}
