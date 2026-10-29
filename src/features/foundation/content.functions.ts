import { createMiddleware, createServerFn } from '@tanstack/react-start'
import { getRequest, setResponseHeader } from '@tanstack/react-start/server'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { audienceSchema } from './access-rules'

const visitorAccess = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  const { contentClient } = await import('./content-client.server')
  const client = await contentClient(process.env['SUPABASE_URL'], process.env['SUPABASE_PUBLISHABLE_KEY'], getRequest().headers.get('authorization'))
  setResponseHeader('Cache-Control', 'private, no-store')
  return next({ context: { contentClient: client } })
})
export const listContent = createServerFn({ method: 'POST' }).middleware([visitorAccess])
  .inputValidator(z.object({ kind: z.string().max(80).optional(), search: z.string().trim().max(200).default('') }))
  .handler(async ({ context, data }) => {
    let query = context.contentClient.from('content_items').select('id,title,summary,kind,audience').eq('published', true).order('created_at', { ascending: false }).limit(100)
    if (data.kind) query = query.eq('kind', data.kind)
    if (data.search) query = query.ilike('title', `%${data.search.replace(/[\\%_]/g, '\\$&')}%`)
    const { data: items, error } = await query
    if (error) throw new Error('تعذر تحميل المحتوى')
    return items
  })
export const readContent = createServerFn({ method: 'POST' }).middleware([visitorAccess])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { data: item, error } = await context.contentClient.from('content_items').select('id,title,summary,body,kind,audience').eq('id', data.id).maybeSingle()
    if (error) throw new Error('تعذر تحميل المحتوى')
    if (!item) return null // Do not disclose whether a restricted record exists.
    const { data: files, error: fileError } = await context.contentClient.from('content_files').select('id,file_name').eq('content_id', item.id)
    if (fileError) throw new Error('تعذر تحميل الملفات')
    return { ...item, files: files ?? [] }
  })
export const saveContentAudience = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(audienceSchema).handler(async ({ context, data }) => {
    const { data: allowed, error } = await context.supabase.rpc('is_staff')
    if (error || !allowed) throw new Error('ليس لديك صلاحية تعديل المحتوى')
    const result = await context.supabase.rpc('set_content_audience', { content_uuid: data.contentId, new_audience: data.audience, category_ids: data.categoryIds, group_ids: data.groupIds })
    if (result.error) throw new Error('تعذر حفظ الإتاحة')
    return true
  })
export const getLibrary = createServerFn({ method: 'POST' }).middleware([visitorAccess])
  .inputValidator(z.object({ topicId: z.string().uuid().optional(), typeId: z.string().uuid().optional(), format: z.enum(['pdf', 'word', 'excel', 'powerpoint']).optional(), tagIds: z.array(z.string().uuid()).max(20).default([]), sort: z.enum(['newest', 'oldest', 'title']).default('newest'), page: z.number().int().min(1).max(1000).default(1), search: z.string().trim().max(200).default('') }))
  .handler(async ({ context, data }) => {
    const db = context.contentClient
    const [topics, types, tags, counts, docs] = await Promise.all([
      db.from('knowledge_topics').select('id,parent_id,name,description,icon,sort_order,hidden').eq('hidden', false).order('sort_order'),
      db.from('document_types').select('id,name').eq('hidden', false).order('sort_order'),
      db.from('tags').select('id,name').order('name'),
      db.rpc('topic_document_counts'),
      db.rpc('search_library' as never, { q: data.search, topic: data.topicId ?? null, type_id: data.typeId ?? null, fmt: data.format ?? null, tag_ids: data.tagIds, sort: data.sort, page: data.page, page_size: PAGE_SIZE } as never),
    ])
    if (topics.error || types.error || tags.error || counts.error || docs.error) throw new Error('تعذر تحميل المكتبة')
    const rows = (docs.data ?? []) as unknown as { id: string; title: string; summary: string; document_type_id: string | null; updated_at: string; topic_ids: string[]; formats: string[]; total: number }[]
    return {
      topics: topics.data, types: types.data, tags: tags.data,
      counts: Object.fromEntries(counts.data.map(c => [c.topic_id, Number(c.documents)])) as Record<string, number>,
      documents: rows.map(({ total: _t, ...r }) => r), total: Number(rows[0]?.total ?? 0), pageSize: PAGE_SIZE,
    }
  })
const PAGE_SIZE = 12
export const getDocumentUsage = createServerFn({ method: 'POST' }).middleware([visitorAccess])
  .inputValidator(z.object({ ids: z.array(z.string().uuid()).max(100) }))
  .handler(async ({ context, data }) => {
    const r = await context.contentClient.rpc('document_usage_totals', { docs: data.ids })
    if (r.error) throw new Error('تعذر تحميل الأعداد')
    return r.data.map(row => ({ ...row, views: Number(row.views), download_requests: Number(row.download_requests) }))
  })
// Published documents only; Drive ids never leave the database (formats are kinds only).
export const readDocument = createServerFn({ method: 'POST' }).middleware([visitorAccess])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const db = context.contentClient
    const { data: item, error } = await db.from('content_items').select('id,title,summary,document_type_id,updated_at,document_date,issuer').eq('id', data.id).eq('kind', 'documents').eq('status', 'published').maybeSingle()
    if (error) throw new Error('تعذر تحميل الوثيقة')
    if (!item) return null
    const [type, topics, tags, formats] = await Promise.all([
      item.document_type_id ? db.from('document_types').select('name').eq('id', item.document_type_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
      db.from('content_topics').select('knowledge_topics!inner(id,name)').eq('content_id', item.id),
      db.from('content_tags').select('tags!inner(id,name)').eq('content_id', item.id),
      db.rpc('document_format_kinds' as never, { doc: item.id } as never),
    ])
    if (topics.error || tags.error || formats.error) throw new Error('تعذر تحميل الوثيقة')
    return {
      ...item, typeName: (type.data as { name: string } | null)?.name ?? null,
      topics: (topics.data as unknown as { knowledge_topics: { id: string; name: string } }[]).map(t => t.knowledge_topics),
      tags: (tags.data as unknown as { tags: { id: string; name: string } }[]).map(t => t.tags),
      formats: ((formats.data ?? []) as unknown as string[]),
    }
  })
export const relatedDocuments = createServerFn({ method: 'POST' }).middleware([visitorAccess])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.contentClient.rpc('related_documents' as never, { doc: data.id, lim: 4 } as never)
    if (error) throw new Error('تعذر تحميل الوثائق ذات الصلة')
    return (rows ?? []) as unknown as { id: string; title: string; summary: string; document_type_id: string | null; updated_at: string; formats: string[] }[]
  })
