import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ requireCurrentUser: vi.fn(), createSignedUploadUrl: vi.fn(), uploadToSignedUrl: vi.fn() }))
vi.mock('../lib/auth/dal', () => mocks)
vi.mock('../lib/supabase/server', () => ({ createSupabaseServerClient: () => ({ storage: { from: () => ({
  createSignedUploadUrl: mocks.createSignedUploadUrl, getPublicUrl: (path: string) => ({ data: { publicUrl: `https://fixture.invalid/${path}` } }),
}) } }) }))
vi.mock('../lib/supabase/client', () => ({ supabaseBrowser: { storage: { from: () => ({ uploadToSignedUrl: mocks.uploadToSignedUrl }) } } }))
import { prepareCoverUploadAction } from '../app/actions/storage'
import { uploadCoverFile } from '../lib/cover-upload'
import { MAX_COVER_FILE_SIZE, validateCoverFile } from '../lib/storage'

beforeEach(() => {
  vi.resetAllMocks()
  mocks.requireCurrentUser.mockResolvedValue({ id: 'owner', accessToken: 'fixture' })
  mocks.createSignedUploadUrl.mockResolvedValue({ data: { token: 'one-path-token' }, error: null })
  mocks.uploadToSignedUrl.mockResolvedValue({ error: null })
})
describe('cover upload boundaries', () => {
  it.each([1, 1024 * 1024 + 1, MAX_COVER_FILE_SIZE])('accepts %i bytes through matching client/server checks and direct Storage upload', async (size) => {
    const file = new File([new Uint8Array(size)], 'spoofed.exe', { type: 'image/png' })
    expect(validateCoverFile(file)).toBeNull()
    expect((await uploadCoverFile(file)).success).toBe(true)
    const path = mocks.createSignedUploadUrl.mock.calls[0][0]
    expect(path).toMatch(/^owner\/\d+-[0-9a-f-]+\.png$/)
    expect(mocks.createSignedUploadUrl).toHaveBeenCalledWith(path, { upsert: false })
    expect(mocks.uploadToSignedUrl).toHaveBeenCalledWith(path, 'one-path-token', file, expect.objectContaining({ contentType: 'image/png' }))
  })
  it.each([{ size: MAX_COVER_FILE_SIZE + 1, type: 'image/png' }, { size: 1, type: 'text/html' }, { size: 0, type: 'image/png' }, { size: NaN, type: 'image/png' }])('rejects invalid file metadata %j without issuing a token', async (file) => {
    expect(validateCoverFile(file)).toBeTruthy()
    expect((await prepareCoverUploadAction(file)).data).toBeNull()
    expect(mocks.createSignedUploadUrl).not.toHaveBeenCalled()
  })
  it('returns a storage error without claiming success', async () => {
    mocks.uploadToSignedUrl.mockResolvedValue({ error: { message: 'Upload rejected' } })
    expect(await uploadCoverFile(new File(['x'], 'cover.png', { type: 'image/png' }))).toMatchObject({ success: false, url: null })
  })
  it('requires authentication before signing any path', async () => {
    mocks.requireCurrentUser.mockRejectedValue(new Error('redirect'))
    await expect(prepareCoverUploadAction({ size: 1, type: 'image/png' })).rejects.toThrow('redirect')
    expect(mocks.createSignedUploadUrl).not.toHaveBeenCalled()
  })
})
