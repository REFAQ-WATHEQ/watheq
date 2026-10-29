import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { Shell, PageTitle } from '@/features/foundation/Shell'
import { brandQuery, pageHead } from '@/features/foundation/queries'
import { readDocument, relatedDocuments } from '@/features/foundation/content.functions'
import { useVisitor } from '@/features/library/DocumentLibrary'
import { formatLabels, type FormatKind } from '@/features/library/document-rules'
import { FormatButtons } from '@/features/library/FormatButtons'
import { UsageCounts } from '@/features/library/UsageCounts'
import { requestDocumentFile } from '@/features/library/delivery'

// Metadata stays generic: restricted titles must never reach SSR or link previews.
export const Route = createFileRoute('/documents_/$id')({ head: () => pageHead('تفاصيل الوثيقة', 'وثيقة من مكتبة وثيق المعرفية لجمعية رفاق.'), loader: ({ context }) => context.queryClient.ensureQueryData(brandQuery), component: Page })

function Page() {
  const { id } = Route.useParams(); const visitor = useVisitor(); const load = useServerFn(readDocument)
  const q = useQuery({ queryKey: ['document', visitor, id], queryFn: () => load({ data: { id } }), enabled: visitor !== null, staleTime: 0, gcTime: 0, retry: false })
  const doc = q.data
  const qc = useQueryClient()
  const viewed = useRef('')
  const viewId = useRef<string | null>(null)
  useEffect(() => {
    const identity = `${visitor}:${id}`
    if (!doc || !visitor || viewed.current === identity) return
    viewed.current = identity
    viewId.current = crypto.randomUUID()
    void requestDocumentFile(id, 'view', viewId.current).then(() => qc.invalidateQueries({ queryKey: ['document-usage', visitor, id] })).catch(() => { /* No invented count on failure. */ })
  }, [doc, visitor, id, qc])
  const back = <Link to="/documents" className="inline-flex items-center gap-1 text-sm underline-offset-4 hover:underline"><ArrowRight className="size-4" />العودة إلى المكتبة</Link>
  if (!visitor || q.isPending) return <Shell><section className="site-width py-16"><p role="status" className="text-sm text-muted-foreground">جارٍ تحميل الوثيقة…</p></section></Shell>
  if (q.isError) return <Shell><section className="site-width py-16"><p role="alert" className="mb-4">تعذر تحميل الوثيقة حاليًا.</p>{back}</section></Shell>
  if (!doc) return <Shell><section className="site-width py-16"><h1 className="mb-3 text-2xl font-bold">الوثيقة غير متاحة</h1><p className="mb-6 text-muted-foreground">قد لا تكون الوثيقة موجودة، أو لا تملك صلاحية الاطلاع عليها. {visitor === 'anonymous' && 'جرّب تسجيل الدخول.'}</p>{back}</section></Shell>
  return <Shell><PageTitle title={doc.title} subtitle={doc.typeName ?? 'وثيقة'} />
    <section className="site-width grid gap-10 py-10 lg:grid-cols-[1fr_320px]">
      <div>{back}
        {doc.summary ? <p className="mt-6 whitespace-pre-line leading-8">{doc.summary}</p> : <p className="mt-6 text-muted-foreground">لا يوجد وصف لهذه الوثيقة.</p>}
        <h2 className="mt-10 mb-4 text-lg font-bold">الصيغ المتوفرة</h2>
        {doc.formats.length ? <ul className="grid gap-3">{doc.formats.map(f => <li key={f} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
          <strong>{formatLabels[f as FormatKind] ?? f}</strong>
          <FormatButtons key={visitor} formats={[f]} title={doc.title} documentId={doc.id} />
        </li>)}</ul> : <p className="text-sm text-muted-foreground">لا توجد صيغ مضافة.</p>}
      </div>
      <aside className="h-fit rounded-xl border border-border bg-card p-5 text-sm">
        <dl className="grid gap-4">
          <div><dt className="text-muted-foreground">النوع</dt><dd className="font-semibold">{doc.typeName ?? '—'}</dd></div>
          <div><dt className="text-muted-foreground">الموضوعات</dt><dd className="mt-1 flex flex-wrap gap-2">{doc.topics.length ? doc.topics.map(t => <Link key={t.id} to="/documents" search={{ topic: t.id }} className="rounded-full bg-accent px-2 py-0.5">{t.name}</Link>) : '—'}</dd></div>
          <div><dt className="text-muted-foreground">الوسوم</dt><dd className="mt-1 flex flex-wrap gap-2">{doc.tags.length ? doc.tags.map(t => <Link key={t.id} to="/documents" search={{ tags: [t.id] }} className="rounded-full border border-border px-2 py-0.5"># {t.name}</Link>) : '—'}</dd></div>
          <div><dt className="text-muted-foreground">آخر تحديث</dt><dd className="font-semibold">{new Date(doc.updated_at).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })}</dd></div>
        </dl>
        <div className="mt-5"><UsageCounts id={doc.id} visitor={visitor} /></div>
      </aside>
    </section>
    <Related id={doc.id} visitor={visitor} />
  </Shell>
}

function Related({ id, visitor }: { id: string; visitor: string }) {
  const load = useServerFn(relatedDocuments)
  const q = useQuery({ queryKey: ['related', visitor, id], queryFn: () => load({ data: { id } }), staleTime: 0, gcTime: 0, retry: false })
  if (!q.data?.length) return null
  return <section className="site-width border-t border-border py-10" aria-labelledby="related-title">
    <h2 id="related-title" className="mb-5 text-xl font-bold">وثائق ذات صلة</h2>
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{q.data.map(r => <li key={r.id} className="flex flex-col rounded-xl border border-border bg-card p-5">
      <Link to="/documents/$id" params={{ id: r.id }} className="font-bold underline-offset-4 hover:underline">{r.title}</Link>
      {r.summary && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{r.summary}</p>}
      <div className="mt-auto pt-4"><FormatButtons key={visitor} formats={r.formats} title={r.title} documentId={r.id} /><div className="mt-3"><UsageCounts id={r.id} visitor={visitor} /></div></div>
    </li>)}</ul>
  </section>
}
