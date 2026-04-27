import Skeleton from '../components/Skeleton'

export default function HomeLoading() {
  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 pb-32 sm:px-6 lg:px-8">
      <header className="mb-10 mt-6 space-y-4">
        <Skeleton className="h-4 w-28 rounded-xl" />
        <Skeleton className="h-14 w-72 max-w-full rounded-xl" />
        <Skeleton className="h-5 w-[34rem] max-w-full rounded-xl" />
      </header>

      <section className="mb-8 space-y-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="glass-panel surface-highlight rounded-xl p-5"
            >
              <Skeleton className="h-4 w-24 rounded-xl" />
              <Skeleton className="mt-4 h-10 w-20 rounded-xl" />
            </div>
          ))}
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
          <Skeleton className="glass-panel-soft h-14 rounded-xl" />
          <Skeleton className="glass-panel-soft h-14 rounded-xl" />
        </div>

        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="glass-panel-soft h-11 w-24 rounded-xl" />
          ))}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 12 }).map((_, index) => (
          <div key={index} className="space-y-3">
            <Skeleton className="aspect-[2/3] rounded-xl" />
            <Skeleton className="h-5 rounded-xl" />
            <Skeleton className="h-4 w-2/3 rounded-xl" />
          </div>
        ))}
      </section>
    </main>
  )
}
