import Link from 'next/link'

export default function SetupNotice() {
  return (
    <section className="mb-8 min-w-0 rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-5 shadow-xl shadow-slate-950/10">
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-2">
          <p className="text-sm uppercase tracking-[0.25em] text-amber-200/80">Setup needed</p>
          <h2 className="text-xl font-semibold text-white">
            User ownership is not active in the database yet
          </h2>
          <p className="max-w-3xl text-sm text-amber-50/80">
            The app is still running in compatibility mode. Apply the existing Supabase
            migration to enable `user_id`, row-level security, and true per-user privacy.
          </p>
        </div>

        <Link
          href="/setup"
          className="inline-flex shrink-0 items-center justify-center rounded-xl border border-amber-300/40 bg-amber-200/10 px-4 py-2 text-sm font-medium text-amber-50 transition hover:bg-amber-200/20"
        >
          Open setup guide
        </Link>
      </div>
    </section>
  )
}
