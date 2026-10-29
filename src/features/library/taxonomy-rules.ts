import { z } from 'zod'
import { BookOpen, Users, Megaphone, Landmark, Wallet, UserRound, Target, KanbanSquare, BadgeCheck, Handshake, HeartHandshake, Cpu, FlaskConical, Scale, FileText, Lightbulb, type LucideIcon } from 'lucide-react'

export const topicIcons: Record<string, LucideIcon> = { BookOpen, Users, Megaphone, Landmark, Wallet, UserRound, Target, KanbanSquare, BadgeCheck, Handshake, HeartHandshake, Cpu, FlaskConical, Scale, FileText, Lightbulb }
export const iconNames = Object.keys(topicIcons) as [string, ...string[]]
export const iconFor = (name: string) => topicIcons[name] ?? BookOpen

// Mirrors the database duplicate rule: trim, collapse inner spaces, ignore letter case.
export const normalizeName = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase()

export type TopicRow = { id: string; parent_id: string | null; name: string; description: string; icon: string; sort_order: number; hidden: boolean }
export type TopicNode = TopicRow & { children: TopicNode[] }
export function buildTree(rows: TopicRow[]): TopicNode[] {
  const map = new Map(rows.map(r => [r.id, { ...r, children: [] as TopicNode[] }]))
  const roots: TopicNode[] = []
  for (const node of map.values()) (node.parent_id && map.get(node.parent_id) ? map.get(node.parent_id)!.children : roots).push(node)
  const sort = (list: TopicNode[]) => { list.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'ar')); list.forEach(n => sort(n.children)) }
  sort(roots)
  return roots
}
// Ids that cannot become the parent of `id` (itself and its descendants).
export function blockedParents(rows: TopicRow[], id: string): Set<string> {
  const blocked = new Set([id]); let grew = true
  while (grew) { grew = false; for (const r of rows) if (r.parent_id && blocked.has(r.parent_id) && !blocked.has(r.id)) { blocked.add(r.id); grew = true } }
  return blocked
}

const name = z.string().trim().min(2, 'الاسم لا يقل عن حرفين').max(120)
const description = z.string().trim().max(500).default('')
const order = z.number().int().min(0).max(10000)
export const taxonomySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('topic-save'), id: z.string().uuid().optional(), parentId: z.string().uuid().nullable(), name, description, icon: z.enum(iconNames), sortOrder: order, hidden: z.boolean() }),
  z.object({ action: z.literal('type-save'), id: z.string().uuid().optional(), name, description, sortOrder: order, hidden: z.boolean() }),
  z.object({ action: z.literal('tag-save'), id: z.string().uuid().optional(), name }),
  z.object({ action: z.enum(['topic-delete', 'type-delete', 'tag-delete']), id: z.string().uuid() }),
])
export type TaxonomyInput = z.infer<typeof taxonomySchema>
