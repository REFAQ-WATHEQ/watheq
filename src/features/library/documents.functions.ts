import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { documentSchema, statusSchema } from './document-rules'

const deny = 'ليس لديك صلاحية إدارة الوثائق'
const message = (e: { code?: string; message?: string }) => (e.code === 'P0001' && e.message) ? e.message : e.code === '23505' ? 'لكل صيغة رابط واحد فقط' : 'تعذر حفظ الوثيقة'

export const listDocumentsAdmin = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const db = context.supabase
  const { data: ok, error } = await db.rpc('is_staff')
  if (error || !ok) throw new Error(deny)
  const [docs, topics, tags, ct, ctg, formats, cats, groups, cc, cg, types] = await Promise.all([
    db.from('content_items').select('id,title,summary,document_type_id,status,audience,updated_at').eq('kind', 'documents').order('updated_at', { ascending: false }),
    db.from('knowledge_topics').select('id,name,parent_id').order('sort_order'),
    db.from('tags').select('id,name').order('name'),
    db.from('content_topics').select('content_id,topic_id'),
    db.from('content_tags').select('content_id,tag_id'),
    db.from('document_formats').select('id,content_id,format,drive_file_id,label,verify_status,verified_at,verified_mime,verified_size,verify_details'),
    db.from('categories').select('id,name').order('name'),
    db.from('groups').select('id,name').order('name'),
    db.from('content_categories').select('content_id,category_id'),
    db.from('content_groups').select('content_id,group_id'),
    db.from('document_types').select('id,name').order('sort_order'),
  ])
  const all = [docs, topics, tags, ct, ctg, formats, cats, groups, cc, cg, types]
  if (all.some(r => r.error)) throw new Error('تعذر تحميل الوثائق')
  const by = <T extends { content_id: string }>(rows: T[], id: string) => rows.filter(r => r.content_id === id)
  return {
    documents: docs.data!.map(d => ({ ...d,
      topicIds: by(ct.data!, d.id).map(r => r.topic_id), tagIds: by(ctg.data!, d.id).map(r => r.tag_id),
      formats: by(formats.data!, d.id).map(f => ({ id: f.id, format: f.format, driveFileId: f.drive_file_id, label: f.label, verifyStatus: f.verify_status, verifiedAt: f.verified_at, verifiedMime: f.verified_mime, verifiedSize: f.verified_size, reason: String((f.verify_details as Record<string, unknown> | null)?.['reason'] ?? '') })),
      categoryIds: by(cc.data!, d.id).map(r => r.category_id), groupIds: by(cg.data!, d.id).map(r => r.group_id) })),
    driveConfigured: !!(process.env['GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON'] && process.env['GOOGLE_DRIVE_LIBRARY_FOLDER_IDS']),
    topics: topics.data!, tags: tags.data!, types: types.data!, categories: cats.data!, groups: groups.data!,
  }
})

export const saveDocument = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(documentSchema).handler(async ({ context, data }) => {
  const { data: ok, error } = await context.supabase.rpc('is_staff')
  if (error || !ok) throw new Error(deny)
  const r = await context.supabase.rpc('save_document', {
    doc_id: data.id ?? (null as unknown as string), doc_title: data.title, doc_summary: data.summary, type_id: data.typeId as string,
    topic_ids: data.topicIds, tag_ids: data.tagIds, new_audience: data.audience, category_ids: data.categoryIds, group_ids: data.groupIds,
    formats: data.formats.map(f => ({ format: f.format, drive_file_id: f.driveFileId, label: f.label })),
  })
  if (r.error) throw new Error(message(r.error))
  return r.data as string
})

export const setDocumentStatus = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(statusSchema).handler(async ({ context, data }) => {
  const { data: ok, error } = await context.supabase.rpc('is_staff')
  if (error || !ok) throw new Error(deny)
  const r = await context.supabase.rpc('set_document_status', { doc_id: data.id, new_status: data.status })
  if (r.error) throw new Error(message(r.error))
  return true
})

export const verifyFormat = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(z.object({ formatId: z.string().uuid() })).handler(async ({ context, data }) => {
  const { data: ok, error } = await context.supabase.rpc('is_staff')
  if (error || !ok) throw new Error(deny)
  // Only files already saved in a document can be checked; staff cannot probe arbitrary ids.
  const { data: row, error: rowError } = await context.supabase.from('document_formats').select('id,format,drive_file_id').eq('id', data.formatId).maybeSingle()
  if (rowError || !row) throw new Error('الصيغة غير موجودة')
  const { readDriveConfig, verifyDriveFile } = await import('./drive.server')
  const config = readDriveConfig()
  if (!config) throw new Error('لم يكتمل إعداد اتصال Google Drive بعد')
  let result
  try { result = await verifyDriveFile(config, row.drive_file_id, row.format) } catch { throw new Error('تعذر الاتصال بـ Google Drive؛ تحقق من إعداد حساب الخدمة') }
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const upd = await supabaseAdmin.from('document_formats').update({ verify_status: result.ok ? 'ok' : 'failed', verified_at: new Date().toISOString(), verified_mime: result.mime, verified_size: result.size, verify_details: { ...result.details, reason: result.reason } as never }).eq('id', row.id).eq('drive_file_id', row.drive_file_id)
  if (upd.error) throw new Error('تعذر حفظ نتيجة التحقق')
  return { ok: result.ok, reason: result.reason }
})

export const listDocumentEvents = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), page: z.number().int().min(1).max(10000).default(1) }))
  .handler(async ({ context, data }) => {
    const { data: allowed, error } = await context.supabase.rpc('is_staff')
    if (error || !allowed) throw new Error(deny)
    const events = await context.supabase.from('document_events').select('id,user_id,format_id,event,created_at').eq('content_id', data.id).order('created_at', { ascending: false }).range((data.page - 1) * 20, data.page * 20)
    if (events.error) throw new Error('تعذر تحميل السجل')
    const rows = (events.data ?? []).slice(0, 20)
    const userIds = rows.flatMap(r => r.user_id ? [r.user_id] : [])
    const formatIds = rows.flatMap(r => r.format_id ? [r.format_id] : [])
    const [users, formats] = await Promise.all([
      context.supabase.from('profiles').select('id,full_name').in('id', userIds),
      context.supabase.from('document_formats').select('id,format').in('id', formatIds),
    ])
    if (users.error || formats.error) throw new Error('تعذر تحميل السجل')
    return { hasMore: (events.data?.length ?? 0) > 20, events: rows.map(r => ({ ...r, userName: r.user_id ? users.data?.find(u => u.id === r.user_id)?.full_name ?? 'مستخدم' : 'زائر', format: formats.data?.find(f => f.id === r.format_id)?.format ?? null })) }
  })
