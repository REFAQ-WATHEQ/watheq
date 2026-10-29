import { describe, expect, it } from 'vitest'
import { cleanLibrarySearch, librarySearchSchema } from '@/features/library/library-search'

const parse = (x: Record<string, unknown>) => cleanLibrarySearch(librarySearchSchema.parse(x))
const id = '20000000-0000-4000-8000-000000000001'
describe('library URL state', () => {
  it('keeps valid search, filters and page', () => expect(parse({ q: ' دليل ', topic: id, format: 'pdf', tags: [id], sort: 'title', page: 3 })).toEqual({ q: 'دليل', topic: id, type: undefined, format: 'pdf', tags: [id], sort: 'title', page: 3 }))
  it('drops malformed ids, formats and sort', () => expect(parse({ topic: 'x', format: 'exe', sort: 'drop', tags: ['bad'] })).toMatchObject({ topic: undefined, format: undefined, sort: 'newest', tags: [] }))
  it('clamps the page number', () => { expect(parse({ page: -4 }).page).toBe(1); expect(parse({ page: 99999 }).page).toBe(1000) })
})
