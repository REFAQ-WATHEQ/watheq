import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { listDocumentEvents } from './documents.functions'

export function DocumentEvents({ id }: { id: string }) {
  const [open, setOpen] = useState(false); const [page, setPage] = useState(1)
  const load = useServerFn(listDocumentEvents)
  const q = useQuery({ queryKey: ['document-events', id, page], queryFn: () => load({ data: { id, page } }), enabled: open })
  return <div className="mt-2 min-w-48 font-normal">
    <Button size="sm" variant="ghost" onClick={() => setOpen(o => !o)}><History />سجل الاستخدام</Button>
    {open && <div className="mt-2 text-xs">
      {q.isPending ? <p role="status">جارٍ التحميل…</p> : q.isError ? <p role="alert">تعذر تحميل السجل</p> : <>
        {q.data?.events.length ? <ul className="grid gap-2">{q.data.events.map(e => <li key={e.id}>
          {e.event === 'view' ? 'مشاهدة' : 'طلب تنزيل'}{e.format ? ` · ${e.format}` : ''} · {e.userName} · {new Date(e.created_at).toLocaleString('ar-SA')}
        </li>)}</ul> : <p>لا توجد أحداث مسجلة</p>}
        <div className="mt-2 flex gap-2"><Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>السابق</Button><Button size="sm" variant="outline" disabled={!q.data?.hasMore} onClick={() => setPage(p => p + 1)}>التالي</Button></div>
      </>}
    </div>}
  </div>
}
