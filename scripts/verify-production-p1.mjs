// Opt-in synthetic-account checks. No service role, private fixtures or secrets in logs.
import assert from 'node:assert/strict'
import nextEnv from '@next/env'
import { createClient } from '@supabase/supabase-js'

if (process.env.MEDIA_VAULT_RLS_VERIFY !== '1') throw new Error('Explicit verification opt-in required.')
nextEnv.loadEnvConfig(process.cwd())
const f = JSON.parse(process.env.MEDIA_VAULT_RLS_FIXTURE ?? '{}')
const site = new URL(f.siteUrl)
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
const client = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, options)
const a = client(), b = client(), anon = client()
const paths = []
let passed = 0
const check = (name, actual, expected) => { assert.deepEqual(actual, expected, name); passed++; console.log(`PASS ${name}`) }
const must = r => { if (r.error) throw new Error(`Request rejected (${r.status ?? r.error.status ?? r.error.code ?? 'unknown'})`); return r.data }
let cookie = ''
const request = (path, init = {}) => fetch(new URL(path, site), { signal: AbortSignal.timeout(30000), cache: 'no-store', ...init, headers: { Cookie: cookie, ...init.headers } })
async function actionId(name, html) {
  const sources = [...new Set([...html.matchAll(/src="([^"]+\/_next\/static\/[^"?]+\.js|\/_next\/static\/[^"?]+\.js)/g)].map(x => x[1]))]
  for (const source of sources) {
    const js = await (await fetch(new URL(source, site), { signal: AbortSignal.timeout(10000) })).text()
    const match = [...js.matchAll(/createServerReference\)\("([a-f0-9]+)"[^;]{0,180}?"([A-Za-z]+)"\)/g)].find(x => x[2] === name)
    if (match) return match[1]
  }
  throw new Error(`Could not find deployed action ${name}`)
}
async function invoke(path, id, args) {
  const response = await request(path, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8', 'Next-Action': id, Origin: site.origin, Accept: 'text/x-component' }, body: JSON.stringify(args) })
  assert.equal(response.status, 200, 'Server Action HTTP success')
  const flight = await response.text()
  // Return value is a plain JSON object; do not log Flight (may include tokens).
  for (const line of flight.split('\n')) {
    const value = line.slice(line.indexOf(':') + 1)
    if (!value.startsWith('{')) continue
    try { const result = JSON.parse(value); if ('error' in result && ('data' in result || 'restored' in result || 'imported' in result)) return result } catch {}
  }
  throw new Error('Server Action did not return a recognized result')
}
try {
  const signedA = must(await a.auth.signInWithPassword({ email: `p0-${f.a}@example.invalid`, password: f.password }))
  must(await b.auth.signInWithPassword({ email: `p0-${f.b}@example.invalid`, password: f.password }))
  // The preceding adversarial RLS suite intentionally creates a foreign-item
  // membership. Remove that exact synthetic row before testing coherent backups.
  must(await a.from('list_items').delete().eq('id', f.wrongItemLink).eq('user_id', f.a))
  // A bad access token with a real refresh token forces the production refresh path.
  cookie = `media-vault-access-token=expired-synthetic-token; media-vault-refresh-token=${signedA.session.refresh_token}`
  const refreshed = await request('/')
  check('refresh renders the authenticated library', refreshed.status, 200)
  const html = await refreshed.text()
  check('same request receives fresh auth for rendering', html.includes('P0 synthetic A'), true)
  const cookies = refreshed.headers.getSetCookie()
  check('both session cookies persisted', ['media-vault-access-token=', 'media-vault-refresh-token='].every(name => cookies.some(c => c.startsWith(name))), true)
  check('refreshed response cannot be shared by CDN', /private|no-store/.test(refreshed.headers.get('cache-control') ?? ''), true)
  check('session cookies are HttpOnly and Secure', cookies.filter(c => c.startsWith('media-vault-')).every(c => /HttpOnly/i.test(c) && /Secure/i.test(c)), true)
  cookie = cookies.filter(c => c.startsWith('media-vault-')).map(c => c.split(';')[0]).join('; ')
  const access = cookies.find(c => c.startsWith('media-vault-access-token=')).split(';')[0].slice('media-vault-access-token='.length)
  check('persisted token validates as synthetic owner', must(await anon.auth.getUser(decodeURIComponent(access))).user.id, f.a)
  const again = await request('/api/backup')
  check('subsequent request remains authenticated', again.status, 200)
  const backup = await again.json()
  check('owner backup preserves private note', JSON.stringify(backup).includes('P0 synthetic note'), true)

  const backupHtml = await (await request('/backup')).text()
  const restoreAction = await actionId('restoreBackupItemsAction', backupHtml)
  const sample = backup.items.find(item => item.id === f.itemA)
  const restoreRows = ['1980000001', '1980000002'].map((id, index) => ({ ...sample,
    id: index ? f.privateLink : f.goodLink, external_id: id, external_source: 'anilist',
  }))
  const restored = await invoke('/backup', restoreAction, [restoreRows])
  check('restore keeps two distinct IDs with an existing same title', restored.restored, 2)
  check('repeat restore skips exact identities', (await invoke('/backup', restoreAction, [restoreRows])).skipped, 2)
  const importHtml = await (await request('/import')).text()
  const importAction = await actionId('importAniListItems', importHtml)
  const imports = ['1980000003', '1980000004'].map(id => ({ title: `P1 import ${f.run}`, type: 'anime',
    external_source: 'anilist', external_id: id, status: 'Planning', notes: 'Synthetic import note', progress: 0,
  }))
  check('production import keeps same-title distinct identities', (await invoke('/import', importAction, [imports])).imported, 2)
  check('production import skips matching identities on retry', (await invoke('/import', importAction, [imports])).skipped, 2)
  check('restored and imported identities persist independently', must(await a.from('items').select('external_id').eq('user_id', f.a)
    .in('external_id', ['1980000001', '1980000002', '1980000003', '1980000004'])).length, 4)

  const progressAt = '2026-10-28T12:00:00.000Z'
  check('new column starts unknown, without invented backfill', must(await a.from('items').select('last_progress_at').eq('id', f.itemA).single()).last_progress_at, null)
  must(await a.from('items').update({ last_progress_at: progressAt, progress: 2 }).eq('id', f.itemA).select('id').single())
  check('owner progress date round trips', new Date(must(await a.from('items').select('last_progress_at').eq('id', f.itemA).single()).last_progress_at).toISOString(), progressAt)
  must(await a.from('profiles').update({ is_public: true }).eq('id', f.a))
  check('public projection uses actual progress date', new Date(must(await anon.from('public_items').select('last_progress_at').eq('id', f.itemA).single()).last_progress_at).toISOString(), progressAt)
  check('public base notes remain inaccessible', must(await b.from('items').select('notes').eq('id', f.itemA)), [])
  check('public projection still has no notes', Object.hasOwn(must(await anon.from('public_items').select('*').eq('id', f.itemA).single()), 'notes'), false)

  for (const query of ['My Hero Academia', 'Re']) {
    const response = await request('/api/catalog-search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, type: 'anime', mode: 'full' }) })
    check(`production catalog accepts ${query}`, response.status, 200)
    const result = await response.json()
    check(`production catalog returns results for ${query}`, Array.isArray(result.data) && result.data.length > 0, true)
  }

  const coverAction = await actionId('prepareCoverUploadAction', html)
  const max = 5 * 1024 * 1024
  const prepared = await invoke('/', coverAction, [{ size: max, type: 'image/png' }])
  check('production signs exactly owner-scoped cover', prepared.data?.path.startsWith(`${f.a}/`), true)
  const { path, token, url } = prepared.data
  paths.push(path)
  const png = Buffer.alloc(max)
  Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jH1sAAAAASUVORK5CYII=', 'base64').copy(png)
  must(await anon.storage.from('media-covers').uploadToSignedUrl(path, token, png, { contentType: 'image/png' }))
  check('5 MB cover is publicly accessible', (await fetch(url, { method: 'HEAD' })).status, 200)
  const oversized = await invoke('/', coverAction, [{ size: max + 1, type: 'image/png' }])
  check('application rejects cover above 5 MB', oversized.data, null)
  const small = await invoke('/', coverAction, [{ size: 1, type: 'image/png' }])
  paths.push(small.data.path)
  const rejected = await anon.storage.from('media-covers').uploadToSignedUrl(small.data.path, small.data.token, Buffer.alloc(max + 1), { contentType: 'image/png' })
  check('Storage independently rejects actual bytes above 5 MB', Boolean(rejected.error), true)
  check('other user cannot sign uploads in owner folder', Boolean((await b.storage.from('media-covers').createSignedUploadUrl(`${f.a}/forbidden-${f.run}.png`)).error), true)
  must(await a.from('profiles').update({ is_public: false }).eq('id', f.a))
  console.log(`P1 production checks passed: ${passed}`)
} catch (error) {
  console.error(error instanceof assert.AssertionError ? `FAIL ${error.message.split('\n')[0]}` : `Verification failed: ${error.message}`)
  process.exitCode = 1
} finally {
  if (paths.length) {
    const removed = await a.storage.from('media-covers').remove(paths)
    if (removed.error) { console.error('Synthetic cover cleanup failed'); process.exitCode = 1 }
  }
  for (const c of [a, b]) { try { await c.auth.signOut({ scope: 'local' }) } catch {} }
}
