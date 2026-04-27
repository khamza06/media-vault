'use client'

import { useEffect, useState, type FormEvent } from 'react'

import { loginAction, updatePasswordAction } from '../app/actions/auth'
import { supabaseBrowserClient } from '../lib/supabase/browser'
import { useToast } from './ToastProvider'

type MessageTone = 'error' | 'success'

export default function ResetPasswordForm() {
  const { showToast } = useToast()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isReady, setIsReady] = useState(false)
  const [isCheckingLink, setIsCheckingLink] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] = useState<MessageTone | null>(null)

  useEffect(() => {
    let isMounted = true

    async function checkRecoverySession() {
      const currentUrl = new URL(window.location.href)
      const hasRecoveryHint =
        currentUrl.searchParams.get('ready') === '1' ||
        currentUrl.hash.includes('type=recovery') ||
        currentUrl.hash.includes('access_token=')

      const sessionResult = await supabaseBrowserClient.auth.getSession()

      if (!isMounted) {
        return
      }

      setIsReady(Boolean(hasRecoveryHint || sessionResult.data.session))
      setIsCheckingLink(false)
    }

    const {
      data: { subscription },
    } = supabaseBrowserClient.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        setIsReady(true)
        setIsCheckingLink(false)
      }
    })

    checkRecoverySession()

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    setMessageTone(null)

    if (password.length < 6) {
      setMessage('Password must be at least 6 characters.')
      setMessageTone('error')
      return
    }

    if (password !== confirmPassword) {
      setMessage('Passwords do not match.')
      setMessageTone('error')
      return
    }

    setIsSubmitting(true)

    const serverResult = await updatePasswordAction(password)
    if (serverResult.success) {
      showToast(serverResult.message ?? 'Password updated.')
      window.location.replace('/')
      return
    }

    const browserResult = await supabaseBrowserClient.auth.updateUser({ password })

    if (browserResult.error) {
      const nextMessage =
        serverResult.error === 'Open the password reset link from your email, then try again.'
          ? browserResult.error.message
          : serverResult.error ?? browserResult.error.message

      setIsSubmitting(false)
      setMessage(nextMessage)
      setMessageTone('error')
      showToast(nextMessage, 'error')
      return
    }

    const userResult = await supabaseBrowserClient.auth.getUser()
    if (userResult.data.user?.email) {
      const loginResult = await loginAction({
        email: userResult.data.user.email,
        password,
      })

      if (loginResult.success) {
        showToast('Password updated. You are signed in.')
        window.location.replace('/')
        return
      }
    }

    setIsSubmitting(false)
    setMessage('Password updated. Please sign in with your new password.')
    setMessageTone('success')
    showToast('Password updated. Please sign in with your new password.')
    window.location.replace('/login?reset=1')
  }

  return (
    <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-[0_30px_80px_rgba(15,23,42,0.45)] sm:p-7">
      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-[0.28em] text-slate-400">
          Account recovery
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
          Set a new password
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Use the password reset link from your email to choose a new password for
          Media Vault.
        </p>
      </div>

      {!isCheckingLink && !isReady ? (
        <p className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Open the password reset link from your email before changing your password.
          If the link expired, request a new reset email from the sign-in page.
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-200">
            New password
          </span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-12 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30"
            placeholder="At least 6 characters"
            autoComplete="new-password"
            disabled={isSubmitting || isCheckingLink || !isReady}
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-200">
            Confirm password
          </span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="h-12 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30"
            placeholder="Repeat your new password"
            autoComplete="new-password"
            disabled={isSubmitting || isCheckingLink || !isReady}
          />
        </label>

        {message ? (
          <p
            className={`rounded-xl px-4 py-3 text-sm ${
              messageTone === 'success'
                ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
                : 'border border-red-500/30 bg-red-500/10 text-red-200'
            }`}
          >
            {message}
          </p>
        ) : null}

        <button
          type="submit"
          className="min-h-12 w-full touch-manipulation rounded-xl bg-blue-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(59,130,246,0.32)] transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={isSubmitting || isCheckingLink || !isReady}
        >
          {isCheckingLink
            ? 'Checking link...'
            : isSubmitting
              ? 'Updating...'
              : 'Update password'}
        </button>
      </form>
    </div>
  )
}
