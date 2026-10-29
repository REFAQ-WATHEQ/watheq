import { describe, expect, it } from 'vitest'
import { buildTree, blockedParents, normalizeName, taxonomySchema } from '@/features/library/taxonomy-rules'
const row = (id: string, parent_id: string | null, sort_order = 0) => ({ id, parent_id, name: id, description: '', icon: 'BookOpen', sort_order, hidden: false })
describe('taxonomy rules', () => {
  it('normalizes spacing and case like the database', () => expect(normalizeName('  Data   Tag ')).toBe('data tag'))
  it('builds a sorted tree', () => { const t = buildTree([row('b', null, 2), row('a', null, 1), row('c', 'a')]); expect(t.map(n => n.id)).toEqual(['a', 'b']); expect(t[0]!.children[0]!.id).toBe('c') })
  it('blocks self and descendants as parents', () => expect([...blockedParents([row('a', null), row('b', 'a'), row('c', 'b'), row('d', null)], 'a')].sort()).toEqual(['a', 'b', 'c']))
  it('rejects one-letter names and unknown icons', () => { expect(taxonomySchema.safeParse({ action: 'tag-save', name: 'x' }).success).toBe(false); expect(taxonomySchema.safeParse({ action: 'topic-save', parentId: null, name: 'ok name', icon: 'Evil', sortOrder: 1, hidden: false }).success).toBe(false) })
})
