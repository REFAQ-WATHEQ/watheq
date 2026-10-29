import { z } from 'zod'

export const MAX_FILE_BYTES = 20 * 1024 * 1024
export const GOOGLE_EXPORT_BYTES = 10 * 1024 * 1024
export const DELIVERY_TIMEOUT_MS = 45_000
export const deliverySchema = z.object({
  action: z.enum(['download', 'preview', 'view']),
  format: z.enum(['pdf', 'word', 'excel', 'powerpoint']).optional(),
  requestId: z.string().uuid(),
}).strict().refine(d => d.action === 'view' || !!d.format, 'اختر الصيغة')

export class DeliveryError extends Error {
  constructor(message: string, public status = 422) { super(message) }
}

// Bounded buffering permits a clear refusal before any protected bytes are sent.
// Streaming from Google avoids arrayBuffer() allocating an unlimited response.
export async function readLimited(response: Response, limit = MAX_FILE_BYTES, signal?: AbortSignal, onFirstByte?: () => void): Promise<Uint8Array> {
  const declared = Number(response.headers.get('Content-Length'))
  if (Number.isFinite(declared) && declared > limit) {
    await response.body?.cancel()
    throw new DeliveryError('حجم الملف يتجاوز الحد المسموح (20 ميغابايت؛ تصدير Google حتى 10 ميغابايت)', 413)
  }
  const reader = response.body?.getReader()
  if (!reader) throw new DeliveryError('لم يصل محتوى الملف', 502)
  const chunks: Uint8Array[] = []; let length = 0
  const abort = () => { void reader.cancel() }
  signal?.addEventListener('abort', abort, { once: true })
  try {
    while (true) {
      signal?.throwIfAborted()
      const { done, value } = await reader.read()
      if (done) break
      if (length === 0 && value.byteLength > 0) onFirstByte?.()
      length += value.byteLength
      if (length > limit) throw new DeliveryError('حجم الملف يتجاوز الحد المسموح (20 ميغابايت؛ تصدير Google حتى 10 ميغابايت)', 413)
      chunks.push(value)
    }
    signal?.throwIfAborted()
    if (!length) throw new DeliveryError('الملف فارغ', 422)
    const bytes = new Uint8Array(length); let offset = 0
    for (const c of chunks) { bytes.set(c, offset); offset += c.length }
    return bytes
  } catch (e) { await reader.cancel().catch(() => undefined); throw e }
  finally { signal?.removeEventListener('abort', abort); reader.releaseLock() }
}

export async function usageKey(identity: string, documentId: string, format: string, action: string, requestId: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([identity, documentId, format, action, requestId])))
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
}
