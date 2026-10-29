import { afterEach, describe, expect, it, vi } from 'vitest'
import { verifyDriveFile } from '@/features/library/drive.server'

// Test-only RSA key generated per run; no real credentials.
async function config() {
  const kp = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign'])
  const der = new Uint8Array(await crypto.subtle.exportKey('pkcs8', kp.privateKey)); let s = ''; for (const b of der) s += String.fromCharCode(b)
  return { account: { client_email: 'test@invalid.test', private_key: `-----BEGIN PRIVATE KEY-----\n${btoa(s)}\n-----END PRIVATE KEY-----` }, folders: ['LIBRARYFOLDER01'] }
}
function mockDrive(files: Record<string, object>) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('oauth2')) return new Response(JSON.stringify({ access_token: 't' }))
    const id = decodeURIComponent(url.split('/files/')[1]!.split('?')[0]!)
    return files[id] ? new Response(JSON.stringify(files[id])) : new Response('{}', { status: 404 })
  }))
}
afterEach(() => vi.unstubAllGlobals())
const base = { parents: ['LIBRARYFOLDER01'], trashed: false, capabilities: { canDownload: true } }
describe('Drive file check', () => {
  it('accepts a matching PDF inside the library folder', async () => { mockDrive({ F1: { ...base, mimeType: 'application/pdf', size: '2048' } }); expect(await verifyDriveFile(await config(), 'F1', 'pdf')).toMatchObject({ ok: true, size: 2048 }) })
  it('refuses files outside the library folders', async () => { mockDrive({ F1: { ...base, parents: ['OTHER'], mimeType: 'application/pdf' }, OTHER: { parents: [] } }); expect((await verifyDriveFile(await config(), 'F1', 'pdf')).reason).toContain('خارج') })
  it('accepts a file in a sub-folder of the library', async () => { mockDrive({ F1: { ...base, parents: ['SUB'], mimeType: 'application/pdf' }, SUB: { parents: ['LIBRARYFOLDER01'] } }); expect((await verifyDriveFile(await config(), 'F1', 'pdf')).ok).toBe(true) })
  it('refuses folders, trashed files and mismatched types', async () => {
    mockDrive({ A: { ...base, mimeType: 'application/vnd.google-apps.folder' }, B: { ...base, mimeType: 'application/pdf', trashed: true }, C: { ...base, mimeType: 'application/pdf' } })
    const c = await config()
    expect((await verifyDriveFile(c, 'A', 'pdf')).reason).toContain('مجلد'); expect((await verifyDriveFile(c, 'B', 'pdf')).reason).toContain('محذوف'); expect((await verifyDriveFile(c, 'C', 'word')).reason).toContain('لا يطابق')
  })
  it('reports missing or unshared files', async () => { mockDrive({}); expect((await verifyDriveFile(await config(), 'X', 'pdf')).ok).toBe(false) })
  it('treats a Google Doc as an exportable Word format', async () => { mockDrive({ G: { ...base, mimeType: 'application/vnd.google-apps.document' } }); expect(await verifyDriveFile(await config(), 'G', 'word')).toMatchObject({ ok: true }) })
})
