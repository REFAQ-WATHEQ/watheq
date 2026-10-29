import { useQuery } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { getDocumentUsage } from '@/features/foundation/content.functions'

export function UsageCounts({ id, visitor }: { id: string; visitor: string | null }) {
  const load = useServerFn(getDocumentUsage)
  const q = useQuery({ queryKey: ['document-usage', visitor, id], queryFn: () => load({ data: { ids: [id] } }), enabled: visitor !== null, staleTime: 0, gcTime: 0 })
  const count = q.data?.[0]
  if (!count) return null
  return <p className="text-xs text-muted-foreground">المشاهدات: {count.views} · طلبات التنزيل: {count.download_requests}</p>
}
