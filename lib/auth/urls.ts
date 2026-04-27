import 'server-only'

import { headers } from 'next/headers'

import { getConfiguredSiteUrl, getLocalDevelopmentSiteUrl } from './site-url'

export async function getSiteUrl() {
  const configuredSiteUrl = getConfiguredSiteUrl()

  if (configuredSiteUrl) {
    return configuredSiteUrl
  }

  const requestHeaders = await headers()
  const forwardedHost = requestHeaders.get('x-forwarded-host')
  const host = forwardedHost ?? requestHeaders.get('host')
  const forwardedProto = requestHeaders.get('x-forwarded-proto')
  const protocol = forwardedProto ?? (host?.includes('localhost') ? 'http' : 'https')

  if (host) {
    return `${protocol}://${host}`.replace(/\/+$/, '')
  }

  return getLocalDevelopmentSiteUrl()
}

export async function getAuthConfirmUrl(nextPath = '/') {
  const siteUrl = await getSiteUrl()
  const confirmUrl = new URL('/auth/confirm', siteUrl)
  confirmUrl.searchParams.set('next', nextPath)
  return confirmUrl.toString()
}

export async function getAuthCallbackUrl(nextPath = '/') {
  const siteUrl = await getSiteUrl()
  const callbackUrl = new URL('/auth/callback', siteUrl)
  callbackUrl.searchParams.set('next', nextPath)
  return callbackUrl.toString()
}

export async function getPasswordResetUrl() {
  const siteUrl = await getSiteUrl()
  return new URL('/auth/reset-password', siteUrl).toString()
}
