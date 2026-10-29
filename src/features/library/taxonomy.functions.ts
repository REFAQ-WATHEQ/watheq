import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { taxonomySchema } from './taxonomy-rules'

export const getTaxonomy = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data: allowed, error } = await context.supabase.rpc('is_staff')
  if (error || !allowed) throw new Error('ليس لديك صلاحية إدارة التصنيفات')
  const [topics, types, tags, links, items] = await Promise.all([
    context.supabase.from('knowledge_topics').select('id,parent_id,name,description,icon,sort_order,hidden').order('sort_order'),
    context.supabase.from('document_types').select('id,name,description,sort_order,hidden').order('sort_order'),
    context.supabase.from('tags').select('id,name').order('name'),
    context.supabase.from('content_topics').select('topic_id,content_id'),
    context.supabase.from('content_items').select('id,document_type_id').not('document_type_id', 'is', null),
  ])
  if (topics.error || types.error || tags.error || links.error || items.error) throw new Error('تعذر تحميل التصنيفات')
  const topicCounts: Record<string, number> = {}
  for (const l of links.data) topicCounts[l.topic_id] = (topicCounts[l.topic_id] ?? 0) + 1
  const typeCounts: Record<string, number> = {}
  for (const i of items.data) if (i.document_type_id) typeCounts[i.document_type_id] = (typeCounts[i.document_type_id] ?? 0) + 1
  return { topics: topics.data, types: types.data, tags: tags.data, topicCounts, typeCounts }
})

function friendly(error: { code?: string; message?: string }) {
  if (error.code === '23505') return 'الاسم موجود بالفعل (مع تجاهل المسافات وحالة الأحرف)'
  if (error.code === 'P0001' && error.message) return error.message
  if (error.code === '23503') return 'العنصر مرتبط ببيانات أخرى؛ أخفِه بدلًا من حذفه'
  return 'تعذر حفظ التغيير'
}

export const manageTaxonomy = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(taxonomySchema).handler(async ({ context, data }) => {
  const { data: allowed, error: roleError } = await context.supabase.rpc('is_staff')
  if (roleError || !allowed) throw new Error('ليس لديك صلاحية إدارة التصنيفات')
  const db = context.supabase
  let result: { error: { code?: string; message?: string } | null }
  switch (data.action) {
    case 'topic-save': {
      const row = { parent_id: data.parentId, name: data.name, description: data.description, icon: data.icon, sort_order: data.sortOrder, hidden: data.hidden }
      result = data.id ? await db.from('knowledge_topics').update(row).eq('id', data.id) : await db.from('knowledge_topics').insert(row)
      break
    }
    case 'type-save': {
      const row = { name: data.name, description: data.description, sort_order: data.sortOrder, hidden: data.hidden }
      result = data.id ? await db.from('document_types').update(row).eq('id', data.id) : await db.from('document_types').insert(row)
      break
    }
    case 'tag-save':
      result = data.id ? await db.from('tags').update({ name: data.name }).eq('id', data.id) : await db.from('tags').insert({ name: data.name })
      break
    case 'topic-delete': result = await db.from('knowledge_topics').delete().eq('id', data.id); break
    case 'type-delete': result = await db.from('document_types').delete().eq('id', data.id); break
    case 'tag-delete': result = await db.from('tags').delete().eq('id', data.id); break
  }
  if (result.error) throw new Error(friendly(result.error))
  return true
})
