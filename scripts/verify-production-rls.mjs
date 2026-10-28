// Explicit opt-in: uses only UUID-scoped synthetic fixtures provisioned separately.
// Credentials are supplied in memory, never saved or printed. No service-role client.
import assert from 'node:assert/strict'
import nextEnv from '@next/env'
import { createClient } from '@supabase/supabase-js'

if (process.env.MEDIA_VAULT_RLS_VERIFY !== '1') throw new Error('Explicit RLS verification opt-in required.')
nextEnv.loadEnvConfig(process.cwd())
const f = JSON.parse(process.env.MEDIA_VAULT_RLS_FIXTURE ?? '{}')
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
const client = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, options)
const anon = client(), a = client(), b = client()
let passed = 0
const check = (name, actual, expected) => { assert.deepEqual(actual, expected, name); passed++; console.log(`PASS ${name}`) }
const must = (r) => { if (r.error) throw new Error(`Request rejected (${r.status ?? r.error.status ?? r.error.code ?? 'unknown'})`); return r.data }
async function ids(c, table, id) { return must(await c.from(table).select('id').eq('id', id)).map(r => r.id) }
async function visibility(c, expected, name) {
  check(`${name}: item`, await ids(c, 'public_items', f.itemA), expected ? [f.itemA] : [])
  check(`${name}: public list`, await ids(c, 'lists', f.publicList), expected ? [f.publicList] : [])
  check(`${name}: public membership`, await ids(c, 'list_items', f.goodLink), expected ? [f.goodLink] : [])
}
try {
  for (const [c, key] of [[a, 'a'], [b, 'b']]) {
    const email = f[`${key}Email`] ?? `p0-${f[key]}@example.invalid`
    if (!['p0', 'qa'].some(prefix => email === `${prefix}-${f[key]}@example.invalid`)) throw new Error('Only synthetic invalid-domain accounts are allowed.')
    must(await c.auth.signInWithPassword({ email, password: f.password }))
  }
  check('owner reads private item', await ids(a, 'items', f.itemA), [f.itemA])
  await visibility(anon, false, 'anonymous/private profile')
  await visibility(b, false, 'other user/private profile')
  check('private owner note preserved', must(await a.from('items').select('notes').eq('id', f.itemA))[0].notes, 'P0 synthetic note')
  must(await a.from('profiles').update({ is_public: true }).eq('id', f.a).select('id').single())
  await visibility(anon, true, 'anonymous/public profile')
  await visibility(b, true, 'other user/public profile')
  for (const [name, c] of [['anonymous', anon], ['other user', b]]) {
    check(`${name}: base notes inaccessible even on public profile`, must(await c.from('items').select('notes').eq('id', f.itemA)), [])
    check(`${name}: base note search cannot infer private text`, must(await c.from('items').select('id', { count: 'exact' }).eq('id', f.itemA).ilike('notes', '%synthetic%')), [])
    const safeRows = must(await c.from('public_items').select('*').eq('id', f.itemA))
    check(`${name}: public wildcard excludes notes`, Object.hasOwn(safeRows[0], 'notes'), false)
    check(`${name}: public notes selection rejected`, Boolean((await c.from('public_items').select('notes').eq('id', f.itemA)).error), true)
    const embedded = await c.from('public_items').select('id,items(notes)').eq('id', f.itemA)
    check(`${name}: relationship embedding cannot expose notes`, Boolean(embedded.error) || !JSON.stringify(embedded.data).includes('P0 synthetic note'), true)
    check(`${name}: public note filter rejected`, Boolean((await c.from('public_items').select('id').eq('id', f.itemA).ilike('notes', '%synthetic%')).error), true)
    check(`${name}: public view write rejected`, Boolean((await c.from('public_items').update({ title: 'unexpected' }).eq('id', f.itemA)).error), true)
  }
  // Make the second item publicly readable too: rejection must depend on ownership.
  must(await b.from('profiles').update({ is_public: true }).eq('id', f.b).select('id').single())
  check('control: second public item readable', await ids(anon, 'public_items', f.itemB), [f.itemB])
  for (const [name, id] of [['private list', f.privateLink], ['missing slug', f.noSlugLink], ['wrong membership owner', f.wrongOwnerLink], ['wrong item owner', f.wrongItemLink]]) {
    check(`anonymous membership denied: ${name}`, await ids(anon, 'list_items', id), [])
  }
  check('other user cannot update public item', must(await b.from('items').update({ notes: 'unexpected change' }).eq('id', f.itemA).select('id')), [])
  check('other user cannot delete public item', must(await b.from('items').delete().eq('id', f.itemA).select('id')), [])
  const invalid = await b.from('list_items').insert({ user_id: f.b, list_id: f.privateList, item_id: f.itemB }).select('id')
  check('other user cannot add to owner list', Boolean(invalid.error), true)
  must(await a.from('items').update({ progress: 1 }).eq('id', f.itemA).select('id').single())
  check('owner write preserves notes', must(await a.from('items').select('notes,progress').eq('id', f.itemA))[0], { notes: 'P0 synthetic note', progress: 1 })
  if (f.siteUrl) {
    const username = f.publicUsername ?? `p0-${f.run.slice(0, 8)}`
    const slug = f.publicListSlug ?? `p0-${f.run.slice(0, 8)}`
    for (const path of [`/u/${username}`, `/u/${username}/lists/${slug}`, `/public/${f.a}`, `/share/${f.a}`]) {
      const response = await fetch(new URL(path, f.siteUrl), { signal: AbortSignal.timeout(20000), cache: 'no-store' })
      const body = await response.text()
      check(`public page succeeds: ${path.split('/')[1]}`, response.status, 200)
      check(`public page preserves media: ${path.split('/')[1]}`, body.includes('P0 synthetic A'), true)
      check(`public HTML/RSC has no notes: ${path.split('/')[1]}`, body.includes('P0 synthetic note'), false)
    }
  }
  must(await a.from('lists').update({ is_public: false }).eq('id', f.publicList).select('id').single())
  check('list becomes private', await ids(anon, 'list_items', f.goodLink), [])
  check('public profile items remain public', await ids(anon, 'public_items', f.itemA), [f.itemA])
  must(await a.from('lists').update({ is_public: true }).eq('id', f.publicList).select('id').single())
  must(await a.from('profiles').update({ is_public: false }).eq('id', f.a).select('id').single())
  await visibility(anon, false, 'anonymous/visibility revoked')
  await visibility(b, false, 'other user/visibility revoked')
  check('owner retains private list membership', await ids(a, 'list_items', f.goodLink), [f.goodLink])
  check('owner retains private item', await ids(a, 'items', f.itemA), [f.itemA])
  console.log(`RLS checks passed: ${passed}`)
} catch (error) {
  console.error(error instanceof assert.AssertionError ? `FAIL ${error.message.split('\n')[0]}` : `Verification failed: ${error.message}`)
  process.exitCode = 1
} finally {
  for (const c of [a, b]) { try { await c.auth.signOut({ scope: 'local' }) } catch {} }
}
