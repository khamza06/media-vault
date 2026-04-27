'use server'

import { revalidatePath } from 'next/cache'

import { getCurrentUser } from '../../lib/auth/dal'
import { createSupabaseServerClient } from '../../lib/supabase/server'

export type PublicProfile = {
  displayName: string | null
  id: string
  isPublic: boolean
  username: string | null
}

export type ProfileActionResult = {
  error: string | null
  message: string | null
  profile: PublicProfile | null
  success: boolean
}

type ProfileRow = {
  display_name: string | null
  id: string
  is_public: boolean | null
  username: string | null
}

type UpdateProfileInput = {
  displayName?: string | null
  isPublic?: boolean
  username?: string | null
}

const usernamePattern = /^[a-z0-9_-]{3,30}$/

function toPublicProfile(row: ProfileRow): PublicProfile {
  return {
    displayName: row.display_name ?? null,
    id: row.id,
    isPublic: Boolean(row.is_public),
    username: row.username ?? null,
  }
}

function normalizeDisplayName(value: string | null | undefined) {
  const displayName = value?.trim().replace(/\s+/g, ' ') ?? ''

  if (!displayName) {
    return { error: null, value: null }
  }

  if (displayName.length > 80) {
    return { error: 'Display name must be 80 characters or fewer.', value: null }
  }

  return { error: null, value: displayName }
}

function normalizeUsername(value: string | null | undefined, isPublic: boolean) {
  const username = value?.trim().toLowerCase() ?? ''

  if (!username) {
    if (isPublic) {
      return {
        error: 'Choose a username before making your vault public.',
        value: null,
      }
    }

    return { error: null, value: null }
  }

  if (!usernamePattern.test(username)) {
    return {
      error:
        'Username must be 3-30 characters and use only lowercase letters, numbers, underscores, or hyphens.',
      value: null,
    }
  }

  return { error: null, value: username }
}

function getProfileSchemaError(message?: string | null) {
  if (!message) {
    return null
  }

  const normalized = message.toLowerCase()

  if (normalized.includes('relation') && normalized.includes('profiles')) {
    return 'Profile settings are not installed yet. Run the public profiles migration first.'
  }

  if (normalized.includes('profiles_username_format')) {
    return 'Username must use only lowercase letters, numbers, underscores, or hyphens.'
  }

  if (normalized.includes('profiles_display_name_length')) {
    return 'Display name must be 80 characters or fewer.'
  }

  return null
}

export async function getOrCreateProfile(): Promise<ProfileActionResult> {
  const user = await getCurrentUser()

  if (!user) {
    return {
      error: 'Sign in to manage profile settings.',
      message: null,
      profile: null,
      success: false,
    }
  }

  const supabase = createSupabaseServerClient(user.accessToken)
  const existingProfile = await supabase
    .from('profiles')
    .select('id, display_name, username, is_public')
    .eq('id', user.id)
    .maybeSingle()

  if (existingProfile.error) {
    return {
      error:
        getProfileSchemaError(existingProfile.error.message) ??
        'Could not load profile settings.',
      message: null,
      profile: null,
      success: false,
    }
  }

  if (existingProfile.data) {
    return {
      error: null,
      message: null,
      profile: toPublicProfile(existingProfile.data as ProfileRow),
      success: true,
    }
  }

  const insertedProfile = await supabase
    .from('profiles')
    .insert({
      display_name: null,
      id: user.id,
      is_public: false,
      username: null,
    })
    .select('id, display_name, username, is_public')
    .single()

  if (insertedProfile.error || !insertedProfile.data) {
    return {
      error:
        getProfileSchemaError(insertedProfile.error?.message) ??
        'Could not create profile settings.',
      message: null,
      profile: null,
      success: false,
    }
  }

  return {
    error: null,
    message: null,
    profile: toPublicProfile(insertedProfile.data as ProfileRow),
    success: true,
  }
}

export async function updateProfileSettings(
  input: UpdateProfileInput
): Promise<ProfileActionResult> {
  const user = await getCurrentUser()

  if (!user) {
    return {
      error: 'Sign in to update profile settings.',
      message: null,
      profile: null,
      success: false,
    }
  }

  const isPublic = Boolean(input.isPublic)
  const displayName = normalizeDisplayName(input.displayName)
  const username = normalizeUsername(input.username, isPublic)

  if (displayName.error || username.error) {
    return {
      error: displayName.error ?? username.error,
      message: null,
      profile: null,
      success: false,
    }
  }

  const supabase = createSupabaseServerClient(user.accessToken)
  const existingProfile = await supabase
    .from('profiles')
    .select('id, username')
    .eq('id', user.id)
    .maybeSingle()

  if (existingProfile.error) {
    return {
      error:
        getProfileSchemaError(existingProfile.error.message) ??
        'Could not load your current profile.',
      message: null,
      profile: null,
      success: false,
    }
  }

  const oldUsername =
    typeof existingProfile.data?.username === 'string'
      ? existingProfile.data.username
      : null

  if (username.value) {
    const duplicateProfile = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username.value)
      .maybeSingle()

    if (duplicateProfile.error) {
      return {
        error:
          getProfileSchemaError(duplicateProfile.error.message) ??
          'Could not check username availability.',
        message: null,
        profile: null,
        success: false,
      }
    }

    if (duplicateProfile.data && duplicateProfile.data.id !== user.id) {
      return {
        error: 'That username is already taken.',
        message: null,
        profile: null,
        success: false,
      }
    }
  }

  const savedProfile = await supabase
    .from('profiles')
    .upsert(
      {
        display_name: displayName.value,
        id: user.id,
        is_public: isPublic,
        username: username.value,
      },
      { onConflict: 'id' }
    )
    .select('id, display_name, username, is_public')
    .single()

  if (savedProfile.error || !savedProfile.data) {
    const isDuplicateUsername =
      savedProfile.error?.code === '23505' ||
      savedProfile.error?.message?.toLowerCase().includes('duplicate') === true

    return {
      error: isDuplicateUsername
        ? 'That username is already taken.'
        : getProfileSchemaError(savedProfile.error?.message) ??
          'Could not save profile settings.',
      message: null,
      profile: null,
      success: false,
    }
  }

  const profile = toPublicProfile(savedProfile.data as ProfileRow)

  revalidatePath('/')
  revalidatePath('/settings')

  if (oldUsername) {
    revalidatePath(`/u/${oldUsername}`)
  }

  if (profile.username) {
    revalidatePath(`/u/${profile.username}`)
  }

  return {
    error: null,
    message: profile.isPublic
      ? 'Profile saved. Your public vault is live.'
      : 'Profile saved. Your vault is private.',
    profile,
    success: true,
  }
}
