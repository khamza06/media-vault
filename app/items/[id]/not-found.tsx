import Link from 'next/link'

export default function ItemNotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-4 py-10 pb-32 text-center sm:px-6 lg:px-8">
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-8 py-10 shadow-2xl shadow-slate-950/40">
        <p className="text-sm uppercase tracking-[0.25em] text-slate-500">Not Found</p>
        <h1 className="mt-4 text-3xl font-bold text-white">This entry does not exist</h1>
        <p className="mt-3 text-slate-400">
          The item may have been deleted or the link is no longer valid.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-xl border border-blue-500/40 bg-blue-600/20 px-5 py-2.5 text-sm font-medium text-blue-100 transition hover:bg-blue-600/30"
        >
          Return to vault
        </Link>
      </div>
    </main>
  )
}
