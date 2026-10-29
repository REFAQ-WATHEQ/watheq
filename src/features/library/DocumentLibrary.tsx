import { Link, getRouteApi, useHydrated, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { useEffect, useState } from 'react'
import { LayoutGrid, Search, X, ChevronRight, ChevronLeft } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { getLibrary } from '@/features/foundation/content.functions'
import { Shell, PageTitle } from '@/features/foundation/Shell'
import { Button } from '@/components/ui/button'
import { buildTree, iconFor, type TopicNode } from './taxonomy-rules'
import { formatLabels, type FormatKind } from './document-rules'
import { FormatButtons } from './FormatButtons'
import { UsageCounts } from './UsageCounts'
import { cleanLibrarySearch, type LibrarySearch } from './library-search'

export function useVisitor() {
  const hydrated = useHydrated()
  const [id, setId] = useState<string | null>(null)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setId(data.session?.user.id ?? 'anonymous'))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setId(s?.user.id ?? 'anonymous'))
    return () => data.subscription.unsubscribe()
  }, [])
  return hydrated ? id : null
}

const route = getRouteApi('/documents')
const date = (iso: string) => new Date(iso).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })

export function DocumentLibrary() {
  const visitor = useVisitor()
  const load = useServerFn(getLibrary)
  const s = cleanLibrarySearch(route.useSearch())
  const navigate = useNavigate({ from: '/documents' })
  const set = (patch: Partial<LibrarySearch>, keepPage = false) => navigate({ search: prev => ({ ...prev, ...patch, ...(keepPage ? {} : { page: 1 }) }), resetScroll: false })
  const [text, setText] = useState(s.q)
  useEffect(() => setText(s.q), [s.q])
  useEffect(() => { const t = setTimeout(() => { if (text.trim() !== s.q) set({ q: text.trim() }) }, 350); return () => clearTimeout(t) }, [text])
  const query = useQuery({
    queryKey: ['library', visitor, s],
    queryFn: () => load({ data: { search: s.q, sort: s.sort, page: s.page, tagIds: s.tags, ...(s.topic ? { topicId: s.topic } : {}), ...(s.type ? { typeId: s.type } : {}), ...(s.format ? { format: s.format } : {}) } }),
    enabled: visitor !== null, staleTime: 0, gcTime: 0, placeholderData: p => p,
  })
  const d = query.data
  const roots = d ? buildTree(d.topics) : []
  const all = roots.flatMap(function walk(n): TopicNode[] { return [n, ...n.children.flatMap(walk)] })
  const node = all.find(n => n.id === s.topic)
  const filtered = !!(s.q || s.topic || s.type || s.format || s.tags.length)
  const pages = d ? Math.max(1, Math.ceil(d.total / d.pageSize)) : 1
  const typeName = (id: string | null) => d?.types.find(t => t.id === id)?.name
  const topicName = (id: string) => d?.topics.find(t => t.id === id)?.name
  const clear = () => { setText(''); navigate({ search: { sort: s.sort } }) }
  return <Shell><PageTitle title="مكتبة الوثائق" subtitle="مرجع معرفي منظم بحسب الموضوعات، يضم الأدلة واللوائح والسياسات والدراسات المتاحة لك" />
    <section className="site-width py-10">
      <label className="mb-8 flex max-w-xl items-center gap-2 rounded-lg border border-border bg-card px-4 py-2"><Search className="size-5 text-muted-foreground" aria-hidden /><span className="sr-only">ابحث في عناوين الوثائق وأوصافها</span><input value={text} onChange={e => setText(e.target.value)} maxLength={200} placeholder="ابحث في عناوين الوثائق وأوصافها" className="w-full border-0 bg-transparent" /></label>
      {!visitor || (query.isPending && !d) ? <p role="status" className="text-sm text-muted-foreground">جارٍ تحميل المكتبة…</p> : query.isError || !d ? <div role="alert" className="rounded-md border border-destructive p-4 text-sm">تعذر تحميل المكتبة حاليًا. <button className="underline" onClick={() => query.refetch()}>أعد المحاولة</button></div> : <>
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <li><button onClick={() => set({ topic: undefined })} aria-pressed={!s.topic} className={`flex h-full w-full flex-col items-start gap-3 rounded-xl border p-5 text-start transition ${!s.topic ? 'border-primary bg-accent' : 'border-border bg-card hover:border-support'}`}><LayoutGrid className="size-7 text-support" aria-hidden /><span className="font-bold">جميع الوثائق</span></button></li>
          {roots.map(t => { const Icon = iconFor(t.icon); const n = d.counts[t.id] ?? 0; const on = s.topic === t.id || all.find(x => x.id === s.topic)?.parent_id === t.id; return <li key={t.id}><button onClick={() => set({ topic: t.id })} aria-pressed={on} className={`flex h-full w-full flex-col items-start gap-3 rounded-xl border p-5 text-start transition ${on ? 'border-primary bg-accent' : 'border-border bg-card hover:border-support'}`}><Icon className="size-7 text-support" aria-hidden /><span className="font-bold">{t.name}</span><span className="text-xs text-muted-foreground">{n ? `${n} وثيقة متاحة` : 'لا توجد وثائق متاحة بعد'}</span></button></li> })}
        </ul>
        {node && (node.children.length > 0 || node.parent_id) && <div className="mt-6 flex flex-wrap items-center gap-2 text-sm">
          {node.parent_id && <button className="underline underline-offset-4" onClick={() => set({ topic: node.parent_id ?? undefined })}>↑ {topicName(node.parent_id)}</button>}
          {node.children.length > 0 && <><span className="text-muted-foreground">موضوعات فرعية:</span>{node.children.map(c => <button key={c.id} className="rounded-full border border-border px-3 py-1" onClick={() => set({ topic: c.id })}>{c.name}</button>)}</>}
        </div>}
        <div className="mt-10 grid gap-3 border-b border-border pb-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="grid gap-1 text-sm">نوع الوثيقة<select value={s.type ?? ''} onChange={e => set({ type: e.target.value || undefined })}><option value="">كل الأنواع</option>{d.types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          <label className="grid gap-1 text-sm">الصيغة<select value={s.format ?? ''} onChange={e => set({ format: (e.target.value || undefined) as FormatKind | undefined })}><option value="">كل الصيغ</option>{Object.entries(formatLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="grid gap-1 text-sm">الوسم<select value="" onChange={e => e.target.value && set({ tags: [...s.tags, e.target.value] })}><option value="">{d.tags.length ? 'أضف وسمًا' : 'لا توجد وسوم'}</option>{d.tags.filter(t => !s.tags.includes(t.id)).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          <label className="grid gap-1 text-sm">الترتيب<select value={s.sort} onChange={e => set({ sort: e.target.value as LibrarySearch['sort'] })}><option value="newest">الأحدث تحديثًا</option><option value="oldest">الأقدم تحديثًا</option><option value="title">العنوان (أبجديًا)</option></select></label>
        </div>
        {(filtered) && <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          {s.tags.map(id => <button key={id} onClick={() => set({ tags: s.tags.filter(x => x !== id) })} className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1"># {d.tags.find(t => t.id === id)?.name ?? 'وسم'}<X className="size-3" aria-label="إزالة" /></button>)}
          <Button size="sm" variant="ghost" onClick={clear}><X />مسح البحث والمرشحات</Button>
        </div>}
        <div className="mt-6 flex items-center justify-between"><h2 className="text-xl font-bold">{node?.name ?? 'جميع الوثائق'}</h2><span role="status" className="text-sm text-muted-foreground">{query.isFetching ? 'جارٍ التحديث…' : `${d.total} نتيجة`}</span></div>
        {d.documents.length ? <ul className="grid gap-5 py-6 sm:grid-cols-2">{d.documents.map(doc => <li key={doc.id} className="flex flex-col rounded-xl border border-border bg-card p-5">
          <Link to="/documents/$id" params={{ id: doc.id }} className="text-lg font-bold underline-offset-4 hover:underline">{doc.title}</Link>
          {doc.summary && <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{doc.summary}</p>}
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {typeName(doc.document_type_id) && <span className="rounded-full bg-primary px-2 py-0.5 text-primary-foreground">{typeName(doc.document_type_id)}</span>}
            {doc.topic_ids.map(id => topicName(id) && <span key={id} className="rounded-full bg-accent px-2 py-0.5">{topicName(id)}</span>)}
          </div>
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4 text-xs text-muted-foreground">
            <FormatButtons key={visitor} formats={doc.formats} title={doc.title} documentId={doc.id} />
            <span>آخر تحديث: {date(doc.updated_at)}</span>
          </div>
          <div className="pt-3"><UsageCounts id={doc.id} visitor={visitor} /></div>
        </li>)}</ul>
          : <p className="py-8 text-sm text-muted-foreground">{filtered ? 'لا توجد وثائق متاحة لك تطابق البحث أو المرشحات.' : 'لا توجد وثائق منشورة متاحة لك حاليًا.'}</p>}
        {pages > 1 && <nav aria-label="الصفحات" className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={s.page <= 1} onClick={() => set({ page: s.page - 1 }, true)}><ChevronRight />السابقة</Button>
          <span className="text-sm">صفحة {Math.min(s.page, pages)} من {pages}</span>
          <Button variant="outline" size="sm" disabled={s.page >= pages} onClick={() => set({ page: s.page + 1 }, true)}>التالية<ChevronLeft /></Button>
        </nav>}
        {d.total > 0 && s.page > pages && <p className="text-center text-sm"><button className="underline" onClick={() => set({ page: 1 }, true)}>العودة إلى الصفحة الأولى</button></p>}
      </>}
    </section></Shell>
}
