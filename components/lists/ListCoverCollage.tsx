import Image from 'next/image'
import { Library } from 'lucide-react'

export default function ListCoverCollage({ covers }: { covers: string[] }) {
  return (
    <div aria-hidden="true" className="mb-4 grid h-32 min-w-0 grid-cols-4 overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="relative min-w-0 border-r border-slate-800/70 bg-gradient-to-br from-blue-500/10 to-slate-950 last:border-r-0">
          {covers[index] ? <Image src={covers[index]} alt="" fill sizes="(max-width: 768px) 25vw, 110px" className="object-cover" />
            : <div className="flex h-full items-center justify-center"><Library className="h-6 w-6 text-slate-700" /></div>}
        </div>
      ))}
    </div>
  )
}
