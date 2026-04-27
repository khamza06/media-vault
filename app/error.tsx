'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-4 py-10 pb-32 text-center sm:px-6 lg:px-8">
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-8 py-10 shadow-2xl shadow-slate-950/40">
        <p className="text-sm uppercase tracking-[0.25em] text-slate-500">Something broke</p>
        <h1 className="mt-4 text-3xl font-bold text-white">
          The vault hit an unexpected error
        </h1>
        <p className="mt-3 text-slate-400">
          {error.message || 'Please try again. If the problem persists, reload the page.'}
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex rounded-xl border border-blue-500/40 bg-blue-600/20 px-5 py-2.5 text-sm font-medium text-blue-100 transition hover:bg-blue-600/30"
        >
          Try again
        </button>
      </div>
    </main>
  )
}
