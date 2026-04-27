export type AuthInput = {
  email: string
  password: string
}

export function validateEmailInput(emailInput: string) {
  const email = emailInput.trim()

  if (!email || !email.includes('@')) {
    return { data: null, error: 'Enter a valid email address.' }
  }

  return { data: email, error: null }
}

export function validatePasswordInput(passwordInput: string) {
  const password = passwordInput.trim()

  if (password.length < 6) {
    return { data: null, error: 'Password must be at least 6 characters.' }
  }

  return { data: password, error: null }
}

export function validateAuthInput(input: AuthInput) {
  const email = validateEmailInput(input.email)
  const password = validatePasswordInput(input.password)

  if (!email.data || email.error) {
    return { data: null, error: email.error ?? 'Enter a valid email address.' }
  }

  if (!password.data || password.error) {
    return { data: null, error: password.error ?? 'Password must be at least 6 characters.' }
  }

  return {
    data: {
      email: email.data,
      password: password.data,
    },
    error: null,
  }
}
