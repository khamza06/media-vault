import { ImageResponse } from 'next/og'

export const alt = 'Media Vault app preview'
export const contentType = 'image/png'
export const size = {
  height: 630,
  width: 1200,
}

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: 'center',
          background:
            'radial-gradient(circle at 22% 16%, rgba(59,130,246,0.42), transparent 32%), linear-gradient(135deg, #020617 0%, #0f172a 48%, #111827 100%)',
          color: '#f8fafc',
          display: 'flex',
          fontFamily: 'Arial',
          height: '100%',
          justifyContent: 'center',
          padding: 72,
          width: '100%',
        }}
      >
        <div
          style={{
            border: '1px solid rgba(148,163,184,0.28)',
            borderRadius: 32,
            boxShadow: '0 32px 120px rgba(15,23,42,0.65)',
            display: 'flex',
            flexDirection: 'column',
            gap: 28,
            padding: 56,
            width: '100%',
          }}
        >
          <div
            style={{
              alignItems: 'center',
              display: 'flex',
              gap: 18,
            }}
          >
            <div
              style={{
                alignItems: 'center',
                background: 'rgba(59,130,246,0.2)',
                border: '1px solid rgba(96,165,250,0.35)',
                borderRadius: 24,
                color: '#bfdbfe',
                display: 'flex',
                fontSize: 34,
                fontWeight: 800,
                height: 82,
                justifyContent: 'center',
                width: 82,
              }}
            >
              MV
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span
                style={{
                  color: '#93c5fd',
                  fontSize: 24,
                  fontWeight: 700,
                  letterSpacing: 5,
                  textTransform: 'uppercase',
                }}
              >
                Personal Media Tracker
              </span>
              <span style={{ fontSize: 72, fontWeight: 900, letterSpacing: -3 }}>
                Media Vault
              </span>
            </div>
          </div>

          <p
            style={{
              color: '#cbd5e1',
              fontSize: 34,
              lineHeight: 1.35,
              margin: 0,
              maxWidth: 860,
            }}
          >
            Track anime, manga, movies, series, and books in one polished personal vault.
          </p>

          <div style={{ display: 'flex', gap: 14, marginTop: 6 }}>
            {['Import', 'Stats', 'Lists', 'Public Profiles'].map((label) => (
              <span
                key={label}
                style={{
                  background: 'rgba(15,23,42,0.72)',
                  border: '1px solid rgba(148,163,184,0.24)',
                  borderRadius: 18,
                  color: '#e2e8f0',
                  fontSize: 22,
                  fontWeight: 700,
                  padding: '14px 20px',
                }}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    ),
    size
  )
}
