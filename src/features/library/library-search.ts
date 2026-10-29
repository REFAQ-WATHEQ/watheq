import { z } from 'zod'
import { fallback } from '@tanstack/zod-adapter'

// Loose URL schema; values are cleaned below so a bad link never breaks the page.
export const librarySearchSchema = z.object({
  q: fallback(z.string(), '').default(''),
  topic: fallback(z.string().optional(), undefined),
  type: fallback(z.string().optional(), undefined),
  format: fallback(z.string().optional(), undefined),
  tags: fallback(z.array(z.string()), []).default([]),
  sort: fallback(z.string(), 'newest').default('newest'),
  page: fallback(z.number(), 1).default(1),
})
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const formats = ['pdf', 'word', 'excel', 'powerpoint'] as const
const sorts = ['newest', 'oldest', 'title'] as const
export type LibrarySearch = { q: string; topic?: string | undefined; type?: string | undefined; format?: (typeof formats)[number] | undefined; tags: string[]; sort: (typeof sorts)[number]; page: number }
export function cleanLibrarySearch(s: z.infer<typeof librarySearchSchema>): LibrarySearch {
  return {
    q: s.q.trim().slice(0, 200),
    topic: s.topic && uuid.test(s.topic) ? s.topic : undefined,
    type: s.type && uuid.test(s.type) ? s.type : undefined,
    format: (formats as readonly string[]).includes(s.format ?? '') ? s.format as LibrarySearch['format'] : undefined,
    tags: [...new Set(s.tags.filter(t => uuid.test(t)))].slice(0, 20),
    sort: (sorts as readonly string[]).includes(s.sort) ? s.sort as LibrarySearch['sort'] : 'newest',
    page: Number.isFinite(s.page) ? Math.min(1000, Math.max(1, Math.floor(s.page))) : 1,
  }
}
