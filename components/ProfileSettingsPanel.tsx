'use client'

import { useState, useTransition, type FormEvent } from 'react'
import Link from 'next/link'
import { Copy, ExternalLink, Globe2, UserRound } from 'lucide-react'
import { useRouter } from 'next/navigation'

import {
  updateProfileSettings,
  type PublicProfile,
} from '../app/actions/profile'
import { useToast } from './ToastProvider'

type ProfileSettingsPanelProps = {
  initialError?: string | null
  initialProfile: PublicProfile | null
}

type MessageTone = 'error' | 'success'

export default function ProfileSettingsPanel({
  initialError = null,
  initialProfile,
}: ProfileSettingsPanelProps) {
  const router = useRouter()
  const { showToast } = useToast()
  const [displayName, setDisplayName] = useState(initialProfile?.displayName ?? '')
  const [username, setUsername] = useState(initialProfile?.username ?? '')
  const [isPublic, setIsPublic] = useState(Boolean(initialProfile?.isPublic))
  const [profile, setProfile] = useState(initialProfile)
  const [message, setMessage] = useState(initialError ?? '')
  const [messageTone, setMessageTone] = useState<MessageTone | null>(
    initialError ? 'error' : null
  )
  const [isPending, startTransition] = useTransition()

  const normalizedUsername = username.trim().toLowerCase()
  const publicPath = profile?.username ? `/u/${profile.username}` : null

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    setMessageTone(null)

    startTransition(async () => {
      const result = await updateProfileSettings({
        displayName,
        isPublic,
        username,
      })

      if (!result.success || !result.profile) {
        const nextMessage = result.error ?? 'Could not save profile settings.'
        setMessage(nextMessage)
        setMessageTone('error')
        showToast(nextMessage, 'error')
        return
      }

      setProfile(result.profile)
      setDisplayName(result.profile.displayName ?? '')
      setUsername(result.profile.username ?? '')
      setIsPublic(result.profile.isPublic)
      setMessage(result.message ?? 'Profile saved.')
      setMessageTone('success')
      showToast(result.message ?? 'Profile saved.')
      router.refresh()
    })
  }

  async function copyPublicLink() {
    if (!publicPath) {
      return
    }

    const url = new URL(publicPath, window.location.origin).toString()
    await navigator.clipboard.writeText(url)
    showToast('Public profile link copied.')
  }

  return (
    <>
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-400/20 bg-blue-500/10 text-blue-200">
            <UserRound className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Profile
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">
              Public identity
            </h2>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-slate-200">Display name</span>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="mt-2 min-h-11 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30"
              maxLength={80}
              placeholder="How visitors should see your name"
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-200">Username</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="mt-2 min-h-11 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30"
              placeholder="your-name"
            />
            <span className="mt-2 block text-xs leading-5 text-slate-400">
              Use 3-30 lowercase letters, numbers, underscores, or hyphens.
              {normalizedUsername && normalizedUsername !== username ? (
                <> It will be saved as `{normalizedUsername}`.</>
              ) : null}
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(event) => setIsPublic(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-950 text-blue-500"
            />
            <span>
              <span className="block text-sm font-semibold text-white">
                Make my vault public
              </span>
              <span className="mt-1 block text-xs leading-5 text-slate-400">
                When enabled, anyone with your public profile link can view a read-only
                version of your vault.
              </span>
            </span>
          </label>

          {message ? (
            <p
              className={`rounded-xl border px-4 py-3 text-sm ${
                messageTone === 'success'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
                  : 'border-red-500/30 bg-red-500/10 text-red-200'
              }`}
            >
              {message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isPending}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-blue-400/30 bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isPending ? 'Saving...' : 'Save profile settings'}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-400/20 bg-blue-500/10 text-blue-200">
            <Globe2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Public Vault
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">
              Share profile link
            </h2>
          </div>
        </div>

        <div className="space-y-4">
          {publicPath ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              <p className="text-sm font-semibold text-white">Public profile URL</p>
              <p className="mt-2 break-all text-sm text-blue-200">{publicPath}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href={publicPath}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-blue-400/30 hover:bg-slate-900"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open public profile
                </Link>
                <button
                  type="button"
                  onClick={copyPublicLink}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-blue-400/30 hover:bg-slate-900"
                >
                  <Copy className="h-4 w-4" />
                  Copy public profile link
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
              Choose and save a username before sharing your public profile.
            </div>
          )}

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-sm font-semibold text-white">
              Current visibility: {profile?.isPublic ? 'Public' : 'Private'}
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              Public visitors can only read vault items while this profile is public.
              Edit, delete, import, backup, and list-management controls stay private.
            </p>
          </div>
        </div>
      </section>
    </>
  )
}
