'use client'
import { translateMessage, translateError } from '../lib/ui-i18n'

import { ui } from '../lib/ui-i18n'
import { useLocale } from './LocaleProvider'

import { useState, type FormEvent } from 'react'

import {
  loginAction,
  requestPasswordResetAction,
  resendSignupConfirmationAction,
  signupAction,
} from '../app/actions/auth'
import { useToast } from './ToastProvider'

type Mode = 'login' | 'signup' | 'reset'

type MessageTone = 'error' | 'success'

export default function AuthForm({
  initialEmail = '',
  initialMessage = '',
  initialMessageTone = null,
}: {
  initialEmail?: string
  initialMessage?: string
  initialMessageTone?: MessageTone | null
}) {
  const { locale } = useLocale()

  const { showToast } = useToast()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState(initialMessage)
  const [messageTone, setMessageTone] = useState<MessageTone | null>(initialMessageTone)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [canResendConfirmation, setCanResendConfirmation] = useState(false)

  const isResetMode = mode === 'reset'

  function switchMode(nextMode: Mode) {
    setMode(nextMode)
    setPassword('')
    setMessage('')
    setMessageTone(null)
    setCanResendConfirmation(false)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setMessage('')
    setMessageTone(null)
    setCanResendConfirmation(false)

    let result: Awaited<ReturnType<typeof loginAction>>
    try {
      result =
        mode === 'reset'
          ? await requestPasswordResetAction(email)
          : mode === 'login'
            ? await loginAction({ email, password })
            : await signupAction({ email, password })
    } catch {
      const nextMessage = ui(locale, "Unable to reach Media Vault. Check your connection and try again.")
      setMessage(nextMessage)
      setMessageTone('error')
      showToast(nextMessage, 'error')
      return
    } finally {
      setIsSubmitting(false)
    }

    if (!result.success) {
      const nextMessage = result.error ?? 'Something went wrong.'
      setMessage(result.message ? `${nextMessage} ${result.message}` : nextMessage)
      setMessageTone('error')
      setCanResendConfirmation(result.status === 'email-unconfirmed')
      showToast(nextMessage, 'error')
      return
    }

    if (result.status === 'signed-in') {
      window.location.replace('/')
      return
    }

    const nextMessage = result.message ?? 'Done.'
    setMessage(nextMessage)
    setMessageTone('success')
    showToast(nextMessage)

    if (result.status === 'confirmation-required') {
      setCanResendConfirmation(true)
      setMode('login')
      return
    }

    if (result.status === 'reset-sent') {
      setMode('login')
    }
  }

  async function handleResendConfirmation() {
    setIsResending(true)
    setMessage('')
    setMessageTone(null)

    let result: Awaited<ReturnType<typeof resendSignupConfirmationAction>>
    try {
      result = await resendSignupConfirmationAction(email)
    } catch {
      const nextMessage = ui(locale, "Unable to send the email right now. Check your connection and try again.")
      setMessage(nextMessage)
      setMessageTone('error')
      showToast(nextMessage, 'error')
      return
    } finally {
      setIsResending(false)
    }

    if (!result.success) {
      const nextMessage = result.error ?? 'Unable to resend confirmation email.'
      setMessage(nextMessage)
      setMessageTone('error')
      showToast(nextMessage, 'error')
      return
    }

    const nextMessage =
      result.message ?? 'Confirmation email sent. Check your inbox and spam folder.'
    setMessage(nextMessage)
    setMessageTone('success')
    showToast(nextMessage)
  }

  const title =
    mode === 'login' ? ui(locale, "Sign in") : mode === 'signup' ? ui(locale, "Create account") : ui(locale, "Reset password")
  const subtitle =
    mode === 'login'
      ? ui(locale, "Access your private media vault.")
      : mode === 'signup'
        ? ui(locale, "Create a personal media vault.")
        : ui(locale, "Enter your email and we will send a secure password reset link.")

  return (
    <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-[0_16px_48px_rgba(2,6,23,0.25)] sm:p-7">
      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-[0.28em] text-slate-400"> {ui(locale, "Account")} </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-300">{subtitle}</p>
      </div>

      <div className="relative z-10 mb-6 grid grid-cols-2 gap-2 rounded-xl border border-slate-800 bg-slate-950 p-1">
        <ModeButton
          isActive={mode === 'login'}
          label={ui(locale, "Sign in")}
          disabled={isSubmitting || isResending}
          onClick={() => switchMode('login')}
        />
        <ModeButton
          isActive={mode === 'signup'}
          label={ui(locale, "Sign up")}
          disabled={isSubmitting || isResending}
          onClick={() => switchMode('signup')}
        />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-200"> {ui(locale, "Email")} </span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-12 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30"
            placeholder="you@example.com"
            autoComplete="email"
            disabled={isSubmitting || isResending}
          />
        </label>

        {!isResetMode ? (
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-200"> {ui(locale, "Password")} </span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-12 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30"
              placeholder={ui(locale, "At least 6 characters")}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              disabled={isSubmitting || isResending}
            />
          </label>
        ) : null}

        {mode === 'login' ? (
          <button
            type="button"
            onClick={() => switchMode('reset')}
            disabled={isSubmitting || isResending}
            className="text-sm font-medium text-blue-300 transition hover:text-blue-200"
          > {ui(locale, "Forgot password?")} </button>
        ) : null}

        {message ? (
          <p
            role={messageTone === 'error' ? 'alert' : 'status'}
            className={`rounded-xl px-4 py-3 text-sm ${
              messageTone === 'success'
                ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
                : 'border border-red-500/30 bg-red-500/10 text-red-200'
            }`}
          >
            {messageTone === 'error' ? translateError(locale, message) : translateMessage(locale, message)}
          </p>
        ) : null}

        {canResendConfirmation && email.trim().length > 0 ? (
          <button
            type="button"
            onClick={handleResendConfirmation}
            disabled={isResending || isSubmitting}
            className="min-h-12 w-full touch-manipulation rounded-xl border border-slate-800 bg-slate-950 px-5 py-3 text-sm font-medium text-slate-200 transition hover:border-blue-400/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isResending ? ui(locale, "Sending...") : ui(locale, "Resend confirmation email")}
          </button>
        ) : null}

        <button
          type="submit"
          className="relative z-10 min-h-12 w-full touch-manipulation rounded-xl bg-blue-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(59,130,246,0.32)] transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={isSubmitting || isResending}
        >
          {isSubmitting
            ? ui(locale, "Please wait...")
            : mode === 'login'
              ? ui(locale, "Sign in")
              : mode === 'signup'
                ? ui(locale, "Create account")
                : ui(locale, "Send reset link")}
        </button>

        {isResetMode ? (
          <button
            type="button"
            onClick={() => switchMode('login')}
            className="min-h-11 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2 text-sm font-medium text-slate-300 transition hover:text-white"
          > {ui(locale, "Back to sign in")} </button>
        ) : null}

        <p className="text-xs leading-5 text-slate-400"> {ui(locale, "If confirmation or reset emails do not arrive, check spam and verify the Supabase Auth email settings for this project.")} </p>
      </form>
    </div>
  )
}

function ModeButton({
  isActive,
  label,
  onClick,
  disabled,
}: {
  isActive: boolean
  label: string
  onClick: () => void
  disabled: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative z-10 flex-1 touch-manipulation rounded-xl px-4 py-3 text-sm font-medium transition ${
        isActive
          ? 'bg-blue-500 text-white shadow-[0_10px_24px_rgba(59,130,246,0.28)]'
          : 'text-slate-300 hover:text-white'
      }`}
    >
      {label}
    </button>
  )
}
