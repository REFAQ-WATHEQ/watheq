import { afterEach, describe, expect, it, vi } from 'vitest'
import { DELIVERY_TIMEOUT_MS, GOOGLE_EXPORT_BYTES, MAX_FILE_BYTES, readLimited, usageKey, deliverySchema } from '@/features/library/delivery-rules'

describe('Protected delivery limits and identifiers', () => {
  it('accepts exactly 20 MiB and refuses one byte more with a declared length', async () => {
    expect(MAX_FILE_BYTES).toBe(20 * 1024 * 1024)
    expect((await readLimited(new Response(new Uint8Array(MAX_FILE_BYTES)))).length).toBe(MAX_FILE_BYTES)
    await expect(readLimited(new Response('x', { headers: { 'Content-Length': String(MAX_FILE_BYTES + 1) } }))).rejects.toMatchObject({ status: 413 })
  })
  it('refuses an oversized chunked response without trusting missing length', async () => {
    const stream = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(MAX_FILE_BYTES)); c.enqueue(new Uint8Array(1)); c.close() } })
    await expect(readLimited(new Response(stream))).rejects.toMatchObject({ status: 413 })
  })
  it('limits Google-native exports to exactly 10 MiB', async () => {
    expect(GOOGLE_EXPORT_BYTES).toBe(10 * 1024 * 1024)
    await expect(readLimited(new Response(new Uint8Array(GOOGLE_EXPORT_BYTES + 1)), GOOGLE_EXPORT_BYTES)).rejects.toMatchObject({ status: 413 })
  })
  it('has a 45 second preparation deadline and honors cancellation', async () => {
    expect(DELIVERY_TIMEOUT_MS).toBe(45_000)
    const c = new AbortController(); c.abort()
    await expect(readLimited(new Response('pdf'), MAX_FILE_BYTES, c.signal)).rejects.toBeDefined()
  })
  it('rejects arbitrary file ids, extra fields and download without format', () => {
    const requestId = '10000000-0000-4000-8000-000000000001'
    expect(deliverySchema.safeParse({ requestId, action: 'download' }).success).toBe(false)
    expect(deliverySchema.safeParse({ requestId, action: 'download', format: 'pdf', driveFileId: 'abcdefghijklmnop' }).success).toBe(false)
    expect(deliverySchema.safeParse({ requestId, action: 'download', format: 'pdf' }).success).toBe(true)
  })
  it('reuses a retry key but separates users, documents, formats and actions', async () => {
    const key = await usageKey('a', 'd', 'pdf', 'download_request', 'r')
    expect(await usageKey('a', 'd', 'pdf', 'download_request', 'r')).toBe(key)
    for (const args of [['b','d','pdf','download_request','r'], ['a','e','pdf','download_request','r'], ['a','d','word','download_request','r'], ['a','d','pdf','view','r']]) {
      expect(await usageKey(args[0] ?? '', args[1] ?? '', args[2] ?? '', args[3] ?? '', args[4] ?? '')).not.toBe(key)
    }
  })
})

const state = vi.hoisted(() => ({ allowed: true, status: 'published', formatExists: true, changed: false, revoke: false, counts: 0, adminReads: 0, driveCalls: 0, keys: new Set<string>() }))
vi.mock('@/features/foundation/content-client.server', () => ({ contentClient: async (_url: unknown, _key: unknown, authorization: string | null, authenticated?: (id: string) => void) => {
  if (authorization === 'Bearer invalid') throw new Error('invalid')
  if (authorization) authenticated?.('user')
  return { auth: { getUser: async () => ({ data: { user: { id: 'user' } } }) }, from: () => {
    const query: Record<string, unknown> = {}; for (const k of ['select', 'eq']) query[k] = () => query
    query['maybeSingle'] = async () => ({ data: state.allowed && state.status === 'published' ? { id: '30000000-0000-4000-8000-000000000001', title: 'وثيقة' } : null, error: null })
    return query
  } }
} }))
vi.mock('@/integrations/supabase/client.server', () => ({ supabaseAdmin: { from: () => {
  state.adminReads++
  const query: Record<string, unknown> = {}; let final = false
  query['select'] = () => query; query['eq'] = (k: string) => { if (k === 'id') final = true; return query }
  query['maybeSingle'] = async () => ({ data: state.formatExists && !(final && state.changed) ? { id: 'fmt', format: 'pdf', drive_file_id: 'PRIVATE_FILE_ID' } : null, error: null })
  return query
}, rpc: async (_name: string, args: { key: string }) => { if (!state.keys.has(args.key)) { state.keys.add(args.key); state.counts++ }; return { error: null } } } }))
vi.mock('@/features/library/drive.server', () => ({ readDriveConfig: () => ({}), fetchDriveBytes: async () => {
  state.driveCalls++; if (state.revoke) state.allowed = false
  return { bytes: new TextEncoder().encode('%PDF-1.7\nfixture'), mime: 'application/pdf', extension: 'pdf' }
} }))
import { handleDocumentDelivery } from '@/features/library/delivery.server'
const id = '30000000-0000-4000-8000-000000000001'
const requestId = '10000000-0000-4000-8000-000000000001'
function req(action = 'download', extra: Record<string, string> = {}, bodyExtra = {}) {
  return new Request(`https://watheq.test/api/public/documents/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: 'wathiq_usage=10000000-0000-4000-8000-000000000002', ...extra }, body: JSON.stringify({ action, requestId, ...(action === 'view' ? {} : { format: 'pdf' }), ...bodyExtra }) })
}
afterEach(() => { Object.assign(state, { allowed: true, status: 'published', formatExists: true, changed: false, revoke: false, counts: 0, adminReads: 0, driveCalls: 0 }); state.keys.clear() })
describe('Delivery handler with simulated services', () => {
  it('stops an aborted preview before Google work and does not count it', async () => {
    const controller = new AbortController(); controller.abort()
    const request = new Request(req('preview'), { signal: controller.signal })
    expect((await handleDocumentDelivery(request, id)).status).toBe(504)
    expect(state.driveCalls).toBe(0); expect(state.counts).toBe(0)
  })
  it('releases a permitted PDF without Google identifiers and records one accepted retry', async () => {
    const first = await handleDocumentDelivery(req(), id); const second = await handleDocumentDelivery(req(), id)
    expect(first.status).toBe(200); expect(second.status).toBe(200); expect(state.counts).toBe(1)
    expect(first.headers.get('Cache-Control')).toContain('no-store'); expect(first.headers.get('Vary')).toContain('Authorization')
    expect(JSON.stringify([...first.headers])).not.toContain('PRIVATE_FILE_ID'); expect(await first.text()).toContain('%PDF')
  })
  it('does not record preview as a download', async () => { expect((await handleDocumentDelivery(req('preview'), id)).status).toBe(200); expect(state.counts).toBe(0) })
  it('uses the validated session actor without another auth call', async () => { expect((await handleDocumentDelivery(req('preview', { Authorization: 'Bearer valid' }), id)).status).toBe(200); expect(state.counts).toBe(0) })
  it('records detail views separately without Drive reads', async () => { await handleDocumentDelivery(req('view'), id); await handleDocumentDelivery(req('view'), id); expect(state.counts).toBe(1); expect(state.driveCalls).toBe(0) })
  it.each(['draft', 'archived'])('denies %s before privileged mapping or Google access', async status => {
    state.status = status; expect((await handleDocumentDelivery(req(), id)).status).toBe(404); expect(state.adminReads).toBe(0); expect(state.driveCalls).toBe(0); expect(state.counts).toBe(0)
  })
  it('denies unauthorized audience before privileged mapping', async () => { state.allowed = false; expect((await handleDocumentDelivery(req(), id)).status).toBe(404); expect(state.adminReads).toBe(0); expect(state.counts).toBe(0) })
  it('denies mismatched format association', async () => { state.formatExists = false; expect((await handleDocumentDelivery(req(), id)).status).toBe(404); expect(state.driveCalls).toBe(0); expect(state.counts).toBe(0) })
  it('denies changed mapping before releasing bytes', async () => { state.changed = true; expect((await handleDocumentDelivery(req(), id)).status).toBe(409); expect(state.counts).toBe(0) })
  it('rechecks revoked audience after Google receipt', async () => { state.revoke = true; expect((await handleDocumentDelivery(req(), id)).status).toBe(404); expect(state.counts).toBe(0) })
  it('refuses range requests without counting them', async () => { expect((await handleDocumentDelivery(req('download', { Range: 'bytes=0-100' }), id)).status).toBe(416); expect(state.counts).toBe(0) })
  it('rejects foreign origins and invalid sessions', async () => {
    expect((await handleDocumentDelivery(req('download', { Origin: 'https://evil.test' }), id)).status).toBe(403)
    expect((await handleDocumentDelivery(req('download', { Authorization: 'Bearer invalid' }), id)).status).toBe(403)
    expect(state.driveCalls).toBe(0)
  })
  it('refuses unsupported previews and malformed Watheq ids', async () => {
    expect((await handleDocumentDelivery(req('preview', {}, { format: 'word' }), 'invalid')).status).toBe(404)
    expect((await handleDocumentDelivery(req('download', {}, { driveFileId: 'PRIVATE_FILE_ID' }), id)).status).toBe(400)
  })
})
