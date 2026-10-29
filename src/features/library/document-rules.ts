import { z } from 'zod'

export const formatLabels = { pdf: 'PDF', word: 'Word', excel: 'Excel', powerpoint: 'PowerPoint' } as const
export type FormatKind = keyof typeof formatLabels
export const statusLabels = { draft: 'مسودة', published: 'منشورة', archived: 'مؤرشفة' } as const

const ID = /^[A-Za-z0-9_-]{10,200}$/
// Checks link structure only. Whether the file exists and is accessible needs the Drive connection.
export function parseDriveLink(input: string): { ok: true; id: string } | { ok: false; error: string } {
  const value = input.trim()
  if (!value) return { ok: false, error: 'أدخل رابط Google Drive' }
  let url: URL
  try { url = new URL(value) } catch { return { ok: false, error: 'الرابط غير صالح' } }
  if (url.protocol !== 'https:') return { ok: false, error: 'يجب أن يبدأ الرابط بـ https' }
  if (!['drive.google.com', 'docs.google.com'].includes(url.hostname)) return { ok: false, error: 'الرابط ليس من Google Drive' }
  const path = url.pathname.match(/^\/(?:file|document|spreadsheets|presentation)\/d\/([^/]+)/)
  const id = path?.[1] ?? (url.pathname === '/open' || url.pathname === '/uc' ? url.searchParams.get('id') : null)
  if (url.pathname.startsWith('/drive/folders/')) return { ok: false, error: 'هذا رابط مجلد؛ أدخل رابط ملف' }
  if (!id || !ID.test(id)) return { ok: false, error: 'تعذر استخراج معرّف الملف من الرابط' }
  return { ok: true, id }
}

const uuid = z.string().uuid()
export const documentSchema = z.object({
  id: uuid.optional(),
  title: z.string().trim().min(3, 'العنوان لا يقل عن 3 أحرف').max(250),
  summary: z.string().trim().max(3000).default(''),
  typeId: uuid.nullable(),
  topicIds: z.array(uuid).min(1, 'اختر موضوعًا معرفيًا واحدًا على الأقل').max(20),
  tagIds: z.array(uuid).max(30).default([]),
  audience: z.enum(['everyone', 'registered', 'employees', 'targeted']),
  categoryIds: z.array(uuid).default([]),
  groupIds: z.array(uuid).default([]),
  formats: z.array(z.object({ format: z.enum(['pdf', 'word', 'excel', 'powerpoint']), driveFileId: z.string().regex(ID, 'معرّف ملف غير صالح'), label: z.string().trim().max(120).default('') })).max(4)
    .refine(list => new Set(list.map(f => f.format)).size === list.length, 'لكل صيغة رابط واحد فقط'),
}).refine(d => d.audience !== 'targeted' || d.categoryIds.length + d.groupIds.length > 0, 'اختر فئة أو مجموعة')
export type DocumentInput = z.infer<typeof documentSchema>
export const statusSchema = z.object({ id: uuid, status: z.enum(['draft', 'published', 'archived']) })
