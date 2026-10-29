const CACHE_PREFIX = 'media-vault-shell-'
const CACHE_NAME = `${CACHE_PREFIX}v4`
const OFFLINE_URL = '/offline.html'
const APP_SHELL = [OFFLINE_URL, '/offline-locale.js', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(APP_SHELL.map((path) => new Request(path, { credentials: 'omit' })))
    ).catch(() => {})
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key)))
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
        return (await cache.match(OFFLINE_URL)) || Response.error()
      })
    )
    return
  }

  if (url.origin !== self.location.origin) {
    return
  }

  // No authenticated HTML/RSC, private user images or unbounded runtime assets.
  const shouldCache = APP_SHELL.includes(url.pathname) && !url.search

  if (!shouldCache) {
    return
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse
      }

      return fetch(new Request(event.request, { credentials: 'omit' }))
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
