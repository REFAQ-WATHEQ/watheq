import { z } from 'zod'
import { contentClient } from '@/features/foundation/content-client.server'
import { DELIVERY_TIMEOUT_MS, DeliveryError, deliverySchema, usageKey } from './delivery-rules'
import { fetchDriveBytes, readDriveConfig } from './drive.server'

const privateHeaders = { 'Cache-Control': 'private, no-store, max-age=0', 'X-Content-Type-Options': 'nosniff', 'Vary': 'Authorization, Cookie', 'Accept-Ranges': 'none' }

export async function handleDocumentDelivery(request: Request, id: string): Promise<Response> {
  const headers = new Headers(privateHeaders)
  const started = performance.now()
  const timings: string[] = []
  const measure = (name: string, ms: number) => { timings.push(`${name};dur=${ms.toFixed(1)}`) }
  if (!z.string().uuid().safeParse(id).success) return new Response('الوثيقة غير متاحة', { status: 404, headers })
  const origin = request.headers.get('Origin')
  if (origin && origin !== new URL(request.url).origin) return new Response('طلب غير مسموح', { status: 403, headers })
  if (request.headers.has('Range')) return new Response('طلبات أجزاء الملف غير مدعومة', { status: 416, headers })
  const controller = new AbortController()
  const cancel = () => controller.abort()
  request.signal.addEventListener('abort', cancel, { once: true })
  if (request.signal.aborted) controller.abort()
  const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS)
  try {
    const input = deliverySchema.parse(await request.json())
    controller.signal.throwIfAborted()
    const authorization = request.headers.get('Authorization')
    let step = performance.now()
    let actor: string | null = null
    const db = await contentClient(process.env['SUPABASE_URL'], process.env['SUPABASE_PUBLISHABLE_KEY'], authorization, userId => { actor = userId })
    measure('session', performance.now() - step)
    const permitted = async () => {
      const r = await db.from('content_items').select('id,title').eq('id', id).eq('kind', 'documents').eq('status', 'published').eq('published', true).maybeSingle()
      if (r.error || !r.data) throw new DeliveryError('الوثيقة غير متاحة أو لا تملك صلاحية الوصول', 404)
      return r.data
    }
    step = performance.now()
    const doc = await permitted()
    measure('document_access', performance.now() - step)
    const authorizedAt = performance.now()
    if (authorization && !actor) throw new DeliveryError('جلسة غير صالحة', 401)
    // Privileged mapping is loaded only after caller-scoped RLS authorizes the document.
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const record = async (formatId: string | null, action: 'view' | 'download_request') => {
      controller.signal.throwIfAborted()
      await permitted()
      const key = await usageKey(actor ?? 'anonymous', id, input.format ?? '', action, input.requestId)
      const result = await supabaseAdmin.rpc('record_document_usage', { doc: id, fmt: formatId as unknown as string, actor: actor as unknown as string, action, key })
      if (result.error) throw new DeliveryError('تعذر تسجيل الطلب؛ حاول مجددًا', 503)
    }
    if (input.action === 'view') { await record(null, 'view'); return Response.json({ ok: true }, { headers }) }
    step = performance.now()
    const mapping = await supabaseAdmin.from('document_formats').select('id,drive_file_id,format').eq('content_id', id).eq('format', input.format ?? '').maybeSingle()
    measure('mapping', performance.now() - step)
    if (mapping.error || !mapping.data) throw new DeliveryError('الصيغة غير متاحة', 404)
    const f = mapping.data
    if (input.action === 'preview' && f.format !== 'pdf') throw new DeliveryError('المعاينة غير مدعومة لهذه الصيغة', 415)
    const config = readDriveConfig()
    if (!config) throw new DeliveryError('اتصال الملفات غير متاح حاليًا', 503)
    controller.signal.throwIfAborted()
    const driveStarted = performance.now()
    const file = await fetchDriveBytes(config, f.drive_file_id, f.format, controller.signal, measure)
    const driveEnded = performance.now()
    const [, latest] = await Promise.all([
      permitted(),
      supabaseAdmin.from('document_formats').select('id').eq('id', f.id).eq('content_id', id).eq('format', f.format).eq('drive_file_id', f.drive_file_id).maybeSingle(),
    ])
    if (latest.error || !latest.data) throw new DeliveryError('تغير ملف الوثيقة؛ أعد المحاولة', 409)
    if (input.action === 'download') await record(f.id, 'download_request')
    controller.signal.throwIfAborted()
    const filename = `${doc.title.replace(/[\u0000-\u001f\u007f/\\]/g, '').slice(0, 120)}.${file.extension}`
    headers.set('Content-Type', file.mime)
    headers.set('Content-Length', String(file.bytes.byteLength))
    headers.set('Server-Timing', [...timings, `access;dur=${(authorizedAt - started).toFixed(1)}, drive;dur=${(driveEnded - driveStarted).toFixed(1)}, finalcheck;dur=${(performance.now() - driveEnded).toFixed(1)}`].join(', '))
    headers.set('Content-Disposition', `${input.action === 'preview' ? 'inline' : 'attachment'}; filename="document.${file.extension}"; filename*=UTF-8''${encodeURIComponent(filename)}`)
    return new Response(file.bytes as unknown as BodyInit, { headers })
  } catch (e) {
    if (controller.signal.aborted) return new Response('انتهت مهلة تجهيز الملف (45 ثانية)؛ حاول مجددًا أو استخدم ملفًا أصغر', { status: 504, headers })
    if (e instanceof z.ZodError) return new Response('طلب غير صالح', { status: 400, headers })
    if (e instanceof DeliveryError) return new Response(e.message, { status: e.status, headers })
    return new Response('تعذر الوصول إلى الملف؛ تحقق من الجلسة ثم أعد المحاولة', { status: 403, headers })
  } finally { clearTimeout(timer); request.signal.removeEventListener('abort', cancel) }
}
