'use server'

import { revalidatePath } from 'next/cache'

import { getAuthCallbackUrl, getPasswordResetUrl } from '../../lib/auth/urls'
import { clearSession, getAuthSession, persistSession } from '../../lib/auth/session'
import {
  validateAuthInput,
  validateEmailInput,
  validatePasswordInput,
  type AuthInput,
} from '../../lib/auth/validation'
import { createSupabaseServerClient } from '../../lib/supabase/server'

export type AuthActionStatus =
  | 'confirmation-required'
  | 'email-unconfirmed'
  | 'reset-sent'
  | 'signed-in'
  | 'signed-out'
  | 'updated-password'

type AuthActionResult = {
  error: string | null
  message: string | null
  success: boolean
  status?: AuthActionStatus
}

function isEmailConfirmationError(message?: string | null) {
  if (!message) {
    return false
  }

  const normalizedMessage = message.toLowerCase()
  return (
    normalizedMessage.includes('email not confirmed') ||
    normalizedMessage.includes('confirm your email') ||
    normalizedMessage.includes('not confirmed')
  )
}

function isAuthNetworkError(message?: string | null) {
  if (!message) {
    return false
  }

  const normalizedMessage = message.toLowerCase()
  return (
    normalizedMessage.includes('fetch failed') ||
    normalizedMessage.includes('failed to fetch') ||
    normalizedMessage.includes('network') ||
    normalizedMessage.includes('econn') ||
    normalizedMessage.includes('enotfound') ||
    normalizedMessage.includes('etimedout')
  )
}

function getSafeAuthError(errorMessage?: string | null) {
  if (isEmailConfirmationError(errorMessage)) {
    return 'Please confirm your email before signing in. Check your inbox or resend the confirmation email.'
  }

  if (isAuthNetworkError(errorMessage)) {
    return 'Media Vault cannot reach Supabase Auth right now. Check the Vercel Supabase environment variables and make sure the Supabase project is active.'
  }

  return errorMessage ?? 'Something went wrong. Please try again.'
}

function getAuthNetworkHelpMessage() {
  return 'Verify NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and Supabase Auth URL Configuration for https://media-vault.app.'
}

export async function loginAction(input: AuthInput): Promise<AuthActionResult> {
  const validated = validateAuthInput(input)
  if (!validated.data || validated.error) {
    return { error: validated.error ?? 'Invalid credentials.', message: null, success: false }
  }

  try {
    const supabase = createSupabaseServerClient()
    const result = await supabase.auth.signInWithPassword(validated.data)

    if (result.error || !result.data.session) {
      const emailUnconfirmed = isEmailConfirmationError(result.error?.message)
      return {
        error: getSafeAuthError(result.error?.message ?? 'Unable to sign in.'),
        message: emailUnconfirmed
          ? 'If the email does not arrive, check spam or verify Supabase Auth email settings.'
          : null,
        success: false,
        status: emailUnconfirmed ? 'email-unconfirmed' : undefined,
      }
    }

    await persistSession(result.data.session)
    revalidatePath('/')

    return { error: null, message: 'Signed in.', success: true, status: 'signed-in' }
  } catch {
    return {
      error: 'Media Vault cannot reach Supabase Auth right now.',
      message: getAuthNetworkHelpMessage(),
      success: false,
    }
  }
}

export async function signupAction(input: AuthInput): Promise<AuthActionResult> {
  const validated = validateAuthInput(input)
  if (!validated.data || validated.error) {
    return { error: validated.error ?? 'Invalid credentials.', message: null, success: false }
  }

  try {
    const supabase = createSupabaseServerClient()
    const result = await supabase.auth.signUp({
      ...validated.data,
      options: {
        emailRedirectTo: await getAuthCallbackUrl('/'),
      },
    })

    if (result.error) {
      return {
        error: getSafeAuthError(result.error.message),
        message: isAuthNetworkError(result.error.message) ? getAuthNetworkHelpMessage() : null,
        success: false,
      }
    }

    if (result.data.session) {
      await persistSession(result.data.session)
      revalidatePath('/')

      return {
        error: null,
        message: 'Account created. You are signed in.',
        success: true,
        status: 'signed-in',
      }
    }

    return {
      error: null,
      message:
        'Account created. Check your email to confirm your account before signing in.',
      success: true,
      status: 'confirmation-required',
    }
  } catch {
    return {
      error: 'Media Vault cannot reach Supabase Auth right now.',
      message: getAuthNetworkHelpMessage(),
      success: false,
    }
  }
}

export async function resendSignupConfirmationAction(
  email: string
): Promise<AuthActionResult> {
  const validatedEmail = validateEmailInput(email)
  if (!validatedEmail.data || validatedEmail.error) {
    return {
      error: validatedEmail.error ?? 'Enter a valid email address first.',
      message: null,
      success: false,
    }
  }

  try {
    const supabase = createSupabaseServerClient()
    const result = await supabase.auth.resend({
      email: validatedEmail.data,
      type: 'signup',
      options: {
        emailRedirectTo: await getAuthCallbackUrl('/'),
      },
    })

    if (result.error) {
      return {
        error: getSafeAuthError(result.error.message),
        message: isAuthNetworkError(result.error.message) ? getAuthNetworkHelpMessage() : null,
        success: false,
      }
    }

    return {
      error: null,
      message: 'Confirmation email sent. Check your inbox and spam folder.',
      success: true,
      status: 'confirmation-required',
    }
  } catch {
    return {
      error: 'Media Vault cannot reach Supabase Auth right now.',
      message: getAuthNetworkHelpMessage(),
      success: false,
    }
  }
}

export async function requestPasswordResetAction(
  email: string
): Promise<AuthActionResult> {
  const validatedEmail = validateEmailInput(email)
  if (!validatedEmail.data || validatedEmail.error) {
    return {
      error: validatedEmail.error ?? 'Enter a valid email address first.',
      message: null,
      success: false,
    }
  }

  try {
    const supabase = createSupabaseServerClient()
    const result = await supabase.auth.resetPasswordForEmail(validatedEmail.data, {
      redirectTo: await getPasswordResetUrl(),
    })

    if (result.error) {
      return {
        error: getSafeAuthError(result.error.message),
        message: isAuthNetworkError(result.error.message) ? getAuthNetworkHelpMessage() : null,
        success: false,
      }
    }

    return {
      error: null,
      message: 'Password reset email sent. Check your inbox and spam folder.',
      success: true,
      status: 'reset-sent',
    }
  } catch {
    return {
      error: 'Media Vault cannot reach Supabase Auth right now.',
      message: getAuthNetworkHelpMessage(),
      success: false,
    }
  }
}

export async function updatePasswordAction(passwordInput: string): Promise<AuthActionResult> {
  const validatedPassword = validatePasswordInput(passwordInput)
  if (!validatedPassword.data || validatedPassword.error) {
    return {
      error: validatedPassword.error ?? 'Password must be at least 6 characters.',
      message: null,
      success: false,
    }
  }

  try {
    const session = await getAuthSession()
    if (!session) {
      return {
        error: 'Open the password reset link from your email, then try again.',
        message: null,
        success: false,
      }
    }

    const supabase = createSupabaseServerClient(session.accessToken)
    const result = await supabase.auth.updateUser({
      password: validatedPassword.data,
    })

    if (result.error) {
      return {
        error: result.error.message,
        message: null,
        success: false,
      }
    }

    revalidatePath('/')
    revalidatePath('/login')

    return {
      error: null,
      message: 'Password updated. You are signed in.',
      success: true,
      status: 'updated-password',
    }
  } catch {
    return {
      error: 'Unable to update your password right now. Please try again.',
      message: null,
      success: false,
    }
  }
}

export async function logoutAction() {
  const supabase = createSupabaseServerClient()
  await supabase.auth.signOut()
  await clearSession()
  revalidatePath('/')
  return { error: null, message: 'Signed out.', success: true, status: 'signed-out' }
}
