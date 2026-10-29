// Server-only Google Drive access through a dedicated read-only service account.
// Runs on the Worker runtime: uses WebCrypto, no Node-only libraries.
import { DeliveryError, GOOGLE_EXPORT_BYTES, MAX_FILE_BYTES, readLimited } from './delivery-rules'

const API = 'https://www.googleapis.com/drive/v3'
const SCOPE = 'https://www.googleapis.com/auth/drive.readonly'

type ServiceAccount = { client_email: string; private_key: string; token_uri?: string }
export type DriveConfig = { account: ServiceAccount; folders: string[] }

export function readDriveConfig(): DriveConfig | null {
  const raw = process.env['GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON']
  const folders = (process.env['GOOGLE_DRIVE_LIBRARY_FOLDER_IDS'] ?? '').split(',').map(s => s.trim()).filter(s => /^[A-Za-z0-9_-]{10,200}$/.test(s))
  if (!raw || !folders.length) return null
  try {
    const account = JSON.parse(raw) as ServiceAccount
    if (!account.client_email || !account.private_key) return null
    return { account, folders }
  } catch { return null }
}

const b64url = (data: ArrayBuffer | string) => {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data)
  let s = ''; for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// Credential-keyed isolate memory only. Never cache file scope or visitor permissions.
let cachedToken: { credential: string; token: string; refreshAt: number } | undefined
async function accessToken(account: ServiceAccount, signal?: AbortSignal): Promise<string> {
  signal?.throwIfAborted()
  const fingerprint = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(account)))
  const credential = b64url(fingerprint)
  if (cachedToken?.credential === credential && Date.now() < cachedToken.refreshAt) return cachedToken.token
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = b64url(JSON.stringify({ iss: account.client_email, scope: SCOPE, aud: account.token_uri ?? 'https://oauth2.googleapis.com/token', iat: now, exp: now + 600 }))
  const pem = account.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')
  const der = Uint8Array.from(atob(pem), c => c.charCodeAt(0))
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claims}`))
  const res = await fetch(account.token_uri ?? 'https://oauth2.googleapis.com/token', {
    method: 'POST', signal: signal ?? null, headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${claims}.${b64url(sig)}` }),
  })
  if (!res.ok) { console.error('Drive token failed', res.status); throw new Error('auth') }
  const result = (await res.json()) as { access_token: string; expires_in?: number }
  signal?.throwIfAborted()
  if (!result.access_token) throw new Error('auth')
  const seconds = Number(result.expires_in)
  if (Number.isFinite(seconds) && seconds > 60) cachedToken = { credential, token: result.access_token, refreshAt: Date.now() + (seconds - 60) * 1000 }
  return result.access_token
}

type Meta = { id: string; name?: string; mimeType?: string; size?: string; trashed?: boolean; parents?: string[]; driveId?: string; capabilities?: { canDownload?: boolean }; copyRequiresWriterPermission?: boolean; downloadRestrictions?: unknown }
async function getMeta(token: string, id: string, fields: string, signal?: AbortSignal): Promise<{ status: number; meta?: Meta }> {
  const res = await fetch(`${API}/files/${encodeURIComponent(id)}?supportsAllDrives=true&fields=${encodeURIComponent(fields)}`, { signal: signal ?? null, headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) { if (res.status !== 404) console.error('Drive metadata failed', res.status); return { status: res.status } }
  return { status: 200, meta: (await res.json()) as Meta }
}

const NATIVE: Record<string, string> = { 'application/vnd.google-apps.document': 'word', 'application/vnd.google-apps.spreadsheet': 'excel', 'application/vnd.google-apps.presentation': 'powerpoint' }
const UPLOADED: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'word', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'word',
  'application/vnd.ms-excel': 'excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'excel',
  'application/vnd.ms-powerpoint': 'powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'powerpoint',
}

export type VerifyResult = { ok: boolean; reason: string; mime: string | null; size: number | null; details: Record<string, unknown> }

export async function verifyDriveFile(config: DriveConfig, fileId: string, format: string): Promise<VerifyResult> {
  return checkDriveFile(config, fileId, format, await accessToken(config.account))
}

async function checkDriveFile(config: DriveConfig, fileId: string, format: string, token: string, signal?: AbortSignal): Promise<VerifyResult> {
  const fail = (reason: string, details: Record<string, unknown> = {}): VerifyResult => ({ ok: false, reason, mime: null, size: null, details })
  const first = await getMeta(token, fileId, 'id,parents,driveId,mimeType,size,trashed,capabilities(canDownload)', signal)
  if (first.status === 404 || first.status === 403) return fail('الملف غير موجود أو لم يُشارك مع حساب خدمة وثيق')
  if (!first.meta) return fail('تعذر الوصول إلى Google Drive حاليًا')
  // Only saved file ids enter here; do not use or return metadata until scope is checked.
  const allowed = new Set(config.folders)
  let inScope = !!first.meta.driveId && allowed.has(first.meta.driveId)
  let frontier = first.meta.parents ?? []
  for (let depth = 0; !inScope && frontier.length && depth < 12; depth++) {
    if (frontier.some(p => allowed.has(p))) { inScope = true; break }
    const parents = await Promise.all(frontier.slice(0, 5).map(p => getMeta(token, p, 'parents', signal)))
    frontier = parents.flatMap(m => m.meta?.parents ?? [])
  }
  if (!inScope) return fail('الملف خارج مجلدات المكتبة المعتمدة')
  const meta = first.meta
  const mime = meta.mimeType ?? ''
  const size = meta.size ? Number(meta.size) : null
  const details = { native: mime in NATIVE, canDownload: meta.capabilities?.canDownload ?? null }
  if (mime === 'application/vnd.google-apps.folder') return { ...fail('الرابط يشير إلى مجلد وليس ملفًا'), mime }
  if (meta.trashed) return { ...fail('الملف محذوف (في سلة المهملات)'), mime }
  const actual = UPLOADED[mime] ?? NATIVE[mime]
  if (!actual) return { ok: false, reason: `نوع الملف غير مدعوم (${mime})`, mime, size, details }
  if (actual !== format) return { ok: false, reason: 'نوع الملف الفعلي لا يطابق الصيغة المسجلة', mime, size, details }
  if (meta.capabilities?.canDownload === false) return { ok: false, reason: 'حساب الخدمة لا يملك صلاحية تنزيل الملف', mime, size, details }
  return { ok: true, reason: mime in NATIVE ? 'متاح — ملف Google أصلي يُصدَّر عند التنزيل (حد التصدير 10 ميغابايت)' : 'متاح للتنزيل', mime, size, details }
}

const EXPORTS: Record<string, string> = {
  word: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  powerpoint: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
}
const EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf', 'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt', 'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
}

export async function fetchDriveBytes(config: DriveConfig, fileId: string, format: string, signal: AbortSignal, measure: (name: string, ms: number) => void = () => {}) {
  let start = performance.now()
  const token = await accessToken(config.account, signal)
  measure('google_token', performance.now() - start); start = performance.now()
  const checked = await checkDriveFile(config, fileId, format, token, signal)
  measure('drive_metadata', performance.now() - start)
  if (!checked.ok || !checked.mime) throw new DeliveryError(checked.reason, 422)
  if (checked.size !== null && checked.size > MAX_FILE_BYTES) throw new DeliveryError('حجم الملف يتجاوز الحد المسموح (20 ميغابايت)', 413)
  const native = checked.mime in NATIVE
  const mime = native ? EXPORTS[format] : checked.mime
  if (!mime) throw new DeliveryError('تصدير هذه الصيغة غير مدعوم')
  const endpoint = native ? `/export?mimeType=${encodeURIComponent(mime)}` : '?alt=media&supportsAllDrives=true'
  start = performance.now()
  const res = await fetch(`${API}/files/${encodeURIComponent(fileId)}${endpoint}`, {
    signal, redirect: 'error', headers: { Authorization: `Bearer ${token}` },
  })
  measure('drive_headers', performance.now() - start)
  if (!res.ok) {
    const body = await res.text(); console.error('Drive delivery failed', res.status)
    if (body.includes('exportSizeLimitExceeded')) throw new DeliveryError('تعذر تصدير ملف Google: الحد الأقصى للتصدير 10 ميغابايت. أضف نسخة مرفوعة بالصيغة المطلوبة.', 413)
    throw new DeliveryError(res.status === 403 || res.status === 404 ? 'الملف غير متاح أو سُحبت صلاحية تنزيله' : 'تعذر تنزيل الملف من Google Drive حاليًا', 502)
  }
  start = performance.now()
  const bytes = await readLimited(res, native ? GOOGLE_EXPORT_BYTES : MAX_FILE_BYTES, signal, () => measure('drive_first_byte', performance.now() - start))
  measure('drive_body', performance.now() - start)
  // Recheck location, type and sharing after receipt, before the caller can release bytes.
  start = performance.now()
  const current = await checkDriveFile(config, fileId, format, token, signal)
  measure('drive_recheck', performance.now() - start)
  if (!current.ok || current.mime !== checked.mime) throw new DeliveryError('تغيرت إتاحة الملف أثناء الطلب؛ أعد المحاولة', 409)
  return { bytes, mime, extension: EXTENSIONS[mime] ?? format }
}
