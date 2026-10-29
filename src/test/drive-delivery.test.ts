import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchDriveBytes } from '@/features/library/drive.server'

async function config() {
  const kp = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign'])
  const der = new Uint8Array(await crypto.subtle.exportKey('pkcs8', kp.privateKey)); let s = ''; for (const b of der) s += String.fromCharCode(b)
  return { account: { client_email: 'test@invalid.test', private_key: `-----BEGIN PRIVATE KEY-----\n${btoa(s)}\n-----END PRIVATE KEY-----` }, folders: ['LIBRARYFOLDER01'] }
}
const base = { parents: ['LIBRARYFOLDER01'], mimeType: 'application/pdf', size: '4', capabilities: { canDownload: true } }
function setup(meta: Record<string, unknown> = base, media = new Response('%PDF'), changed?: Record<string, unknown>) {
  let mediaRead = false
  const mock = vi.fn(async (url: string) => {
    if (url.includes('oauth2')) return Response.json({ access_token: 'test-token' })
    if (url.includes('alt=media') || url.includes('/export?')) { mediaRead = true; return media }
    if (url.includes('/files/SUB')) return Response.json({ parents: ['LIBRARYFOLDER01'] })
    return Response.json(mediaRead && changed ? changed : meta)
  })
  vi.stubGlobal('fetch', mock); return mock
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })
describe('Fresh Google delivery (simulated)', () => {
  it('downloads an uploaded PDF in its original format', async () => { const m = setup(); const r = await fetchDriveBytes(await config(), 'F1', 'pdf', new AbortController().signal); expect(new TextDecoder().decode(r.bytes)).toBe('%PDF'); expect(r.mime).toBe('application/pdf'); expect(m.mock.calls.some(([u]) => u.includes('/F1?alt=media'))).toBe(true) })
  it('uses one narrow metadata request per fresh check, before and after receipt', async () => {
    const m = setup(); await fetchDriveBytes(await config(), 'F1', 'pdf', new AbortController().signal)
    const metadata = m.mock.calls.filter(([u]) => u.includes('/files/F1?') && !u.includes('alt=media'))
    expect(metadata).toHaveLength(2)
    expect(new URL(metadata[0]?.[0] ?? '').searchParams.get('fields')).toBe('id,parents,driveId,mimeType,size,trashed,capabilities(canDownload)')
  })
  it('reuses a valid server token but freshly checks sharing on every delivery', async () => {
    const c = await config(); const m = setup()
    m.mockImplementation(async (url: string) => url.includes('oauth2') ? Response.json({ access_token: 'token', expires_in: 3600 }) : url.includes('alt=media') ? new Response('%PDF') : Response.json(base))
    await fetchDriveBytes(c, 'F1', 'pdf', new AbortController().signal)
    await fetchDriveBytes(c, 'F1', 'pdf', new AbortController().signal)
    expect(m.mock.calls.filter(([u]) => u.includes('oauth2'))).toHaveLength(1)
    expect(m.mock.calls.filter(([u]) => u.includes('capabilities'))).toHaveLength(4)
  })
  it('refreshes the token at its 60-second expiry margin', async () => {
    const c = await config(); const m = setup(); let now = 1_800_000_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    m.mockImplementation(async (url: string) => url.includes('oauth2') ? Response.json({ access_token: 'token', expires_in: 120 }) : url.includes('alt=media') ? new Response('%PDF') : Response.json(base))
    await fetchDriveBytes(c, 'F1', 'pdf', new AbortController().signal)
    now += 59_000; await fetchDriveBytes(c, 'F1', 'pdf', new AbortController().signal)
    expect(m.mock.calls.filter(([u]) => u.includes('oauth2'))).toHaveLength(1)
    now += 1_000; await fetchDriveBytes(c, 'F1', 'pdf', new AbortController().signal)
    expect(m.mock.calls.filter(([u]) => u.includes('oauth2'))).toHaveLength(2)
  })
  it('does not reuse a token after credentials change', async () => {
    const c = await config(); const m = setup()
    m.mockImplementation(async (url: string) => url.includes('oauth2') ? Response.json({ access_token: 'token', expires_in: 3600 }) : url.includes('alt=media') ? new Response('%PDF') : Response.json(base))
    await fetchDriveBytes(c, 'F1', 'pdf', new AbortController().signal)
    await fetchDriveBytes({ ...c, account: { ...c.account, client_email: 'rotated@invalid.test' } }, 'F1', 'pdf', new AbortController().signal)
    expect(m.mock.calls.filter(([u]) => u.includes('oauth2'))).toHaveLength(2)
  })
  it.each([{ ...base, trashed: true }, { ...base, mimeType: 'application/msword' }, { ...base, capabilities: { canDownload: false } }])('refuses a changed file after receipt %j', async changed => {
    setup(base, new Response('%PDF'), changed)
    await expect(fetchDriveBytes(await config(), 'F1', 'pdf', new AbortController().signal)).rejects.toMatchObject({ status: 409 })
  })
  it.each([['application/msword','word','doc'], ['application/vnd.ms-excel','excel','xls'], ['application/vnd.ms-powerpoint','powerpoint','ppt']])('preserves uploaded %s', async (mimeType, format, extension) => { setup({ ...base, mimeType }); expect((await fetchDriveBytes(await config(), 'F1', format, new AbortController().signal)).extension).toBe(extension) })
  it.each([['document','word','docx'], ['spreadsheet','excel','xlsx'], ['presentation','powerpoint','pptx']])('exports native Google %s', async (kind, format, extension) => { const m = setup({ ...base, mimeType: `application/vnd.google-apps.${kind}` }); expect((await fetchDriveBytes(await config(), 'F1', format, new AbortController().signal)).extension).toBe(extension); expect(m.mock.calls.some(([u]) => u.includes('/export?mimeType='))).toBe(true) })
  it('accepts approved subfolders', async () => { setup({ ...base, parents: ['SUB'] }); expect((await fetchDriveBytes(await config(), 'F1', 'pdf', new AbortController().signal)).bytes.length).toBe(4) })
  it('refuses a moved file during receipt', async () => { setup(base, new Response('%PDF'), { ...base, parents: [] }); await expect(fetchDriveBytes(await config(), 'F1', 'pdf', new AbortController().signal)).rejects.toMatchObject({ status: 409 }) })
  it('refuses withdrawn sharing at the media request', async () => { setup(base, new Response('{}', { status: 403 })); await expect(fetchDriveBytes(await config(), 'F1', 'pdf', new AbortController().signal)).rejects.toMatchObject({ status: 502 }) })
  it('refuses a file outside the approved folder before fetching media', async () => { const m = setup({ ...base, parents: [] }); await expect(fetchDriveBytes(await config(), 'F1', 'pdf', new AbortController().signal)).rejects.toMatchObject({ status: 422 }); expect(m.mock.calls.some(([u]) => u.includes('alt=media'))).toBe(false) })
  it('refuses MIME mismatch and withdrawn download capability', async () => { setup({ ...base, capabilities: { canDownload: false } }); await expect(fetchDriveBytes(await config(), 'F1', 'pdf', new AbortController().signal)).rejects.toMatchObject({ status: 422 }) })
  it('returns an explicit native export size message', async () => { setup({ ...base, mimeType: 'application/vnd.google-apps.document' }, new Response('{"error":"exportSizeLimitExceeded"}', { status: 403 })); await expect(fetchDriveBytes(await config(), 'F1', 'word', new AbortController().signal)).rejects.toThrow('10 ميغابايت') })
})
