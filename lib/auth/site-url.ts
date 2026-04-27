const PRODUCTION_SITE_URL = 'https://media-vault-seven.vercel.app'
const LOCAL_SITE_URL = 'http://localhost:3000'

function normalizeSiteUrl(url: string) {
  return url.replace(/\/+$/, '')
}

export function getConfiguredSiteUrl() {
  const explicitSiteUrl = process.env.NEXT_PUBLIC_SITE_URL

  if (explicitSiteUrl) {
    return normalizeSiteUrl(explicitSiteUrl)
  }

  const vercelProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  if (vercelProductionUrl) {
    const url = vercelProductionUrl.startsWith('http')
      ? vercelProductionUrl
      : `https://${vercelProductionUrl}`
    return normalizeSiteUrl(url)
  }

  if (process.env.NODE_ENV === 'production') {
    return PRODUCTION_SITE_URL
  }

  return null
}

export function getBrowserSiteUrl() {
  const configuredSiteUrl = getConfiguredSiteUrl()
  if (configuredSiteUrl) {
    return configuredSiteUrl
  }

  if (typeof window !== 'undefined') {
    return window.location.origin
  }

  return LOCAL_SITE_URL
}

export function getLocalDevelopmentSiteUrl() {
  return LOCAL_SITE_URL
}
