import Skeleton from './Skeleton'

type RouteLoadingShellProps = {
  cardCount?: number
  eyebrow?: string
  titleWidth?: string
}

export default function RouteLoadingShell({
  cardCount = 6,
  eyebrow = 'Loading',
  titleWidth = 'w-72',
}: RouteLoadingShellProps) {
  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 pb-32 sm:px-6 lg:px-8">
      <header className="mb-8 mt-4 max-w-3xl space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
          {eyebrow}
        </p>
        <Skeleton className={`h-12 max-w-full ${titleWidth}`} />
        <Skeleton className="h-5 w-[34rem] max-w-full" />
      </header>

      <section className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: cardCount }).map((_, index) => (
          <div
            key={index}
            className="min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-4"
          >
            <Skeleton className="h-5 w-28" />
            <Skeleton className="mt-5 h-9 w-40" />
            <Skeleton className="mt-4 h-4 w-full" />
            <Skeleton className="mt-3 h-4 w-2/3" />
          </div>
        ))}
      </section>
    </main>
  )
}
