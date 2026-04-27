const CACHE_NAME = 'media-vault-shell-v2'
const APP_SHELL = ['/offline', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return
  }

  const url = new URL(event.request.url)

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cache = await caches.open(CACHE_NAME)
        return (await cache.match('/offline')) || Response.error()
      })
    )
    return
  }

  if (url.origin !== self.location.origin) {
    return
  }

  const shouldCache = ['image', 'font'].includes(event.request.destination)

  if (!shouldCache) {
    return
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse
      }

      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200) {
            return response
          }

          const clonedResponse = response.clone()
          void caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clonedResponse))
          return response
        })
        .catch(() => cachedResponse || Response.error())
    })
  )
})
