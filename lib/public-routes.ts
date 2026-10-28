export function isPublicVaultRoute(pathname: string) {
  return pathname.startsWith('/public/') || pathname.startsWith('/u/') ||
    (pathname.startsWith('/share/') && pathname !== '/share/me' && pathname !== '/share/me/')
}
