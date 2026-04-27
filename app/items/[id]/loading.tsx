import Skeleton from '../../../components/Skeleton'

export default function ItemDetailsLoading() {
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-6 pb-32 sm:px-6 lg:px-8">
      <Skeleton className="mb-8 h-10 w-36 rounded-xl" />

      <section className="grid min-w-0 gap-8 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
        <Skeleton className="aspect-[2/3] rounded-xl" />

        <div className="space-y-6">
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24 rounded-xl" />
            <Skeleton className="h-8 w-20 rounded-xl" />
            <Skeleton className="h-8 w-16 rounded-xl" />
          </div>

          <div className="space-y-3">
            <Skeleton className="h-12 w-2/3 rounded-xl" />
            <Skeleton className="h-5 w-full rounded-xl" />
            <Skeleton className="h-5 w-5/6 rounded-xl" />
          </div>

          <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="glass-panel-soft rounded-xl px-4 py-4"
              >
                <Skeleton className="h-4 w-20 rounded-xl" />
                <Skeleton className="mt-3 h-7 w-24 rounded-xl" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
