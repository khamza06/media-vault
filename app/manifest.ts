import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Media Vault',
    short_name: 'Vault',
    description: 'A personal media vault for anime, manga, movies, series, and books.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0f172a',
    theme_color: '#0f172a',
    categories: ['entertainment', 'books', 'productivity'],
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Library',
        short_name: 'Library',
        description: 'Open your library',
        url: '/',
      },
      {
        name: 'Stats',
        short_name: 'Stats',
        description: 'Open your statistics',
        url: '/stats',
      },
      {
        name: 'Lists',
        short_name: 'Lists',
        description: 'Open your smart lists',
        url: '/lists',
      },
    ],
  }
}
