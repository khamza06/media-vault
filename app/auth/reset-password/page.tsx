import ResetPasswordForm from '../../../components/ResetPasswordForm'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl items-center justify-center bg-slate-950 px-4 py-10 pb-32 text-slate-100 sm:px-6 lg:px-8">
      <ResetPasswordForm />
    </main>
  )
}
