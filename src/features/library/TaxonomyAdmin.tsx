import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { ChevronDown, ChevronLeft, Plus, Pencil, Trash2, Eye, EyeOff, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getTaxonomy, manageTaxonomy } from './taxonomy.functions'
import { buildTree, blockedParents, iconFor, iconNames, type TaxonomyInput, type TopicNode, type TopicRow } from './taxonomy-rules'

type Section = 'topics' | 'types' | 'tags'
type TopicDraft = { id?: string; parentId: string | null; name: string; description: string; icon: string; sortOrder: number; hidden: boolean }

export function TaxonomyAdmin({ section }: { section: Section }) {
  const load = useServerFn(getTaxonomy)
  const save = useServerFn(manageTaxonomy)
  const qc = useQueryClient()
  const query = useQuery({ queryKey: ['taxonomy'], queryFn: () => load() })
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  async function run(input: TaxonomyInput, ok: string) {
    setBusy(true); setMessage(null)
    try { await save({ data: input }); await Promise.all([qc.invalidateQueries({ queryKey: ['taxonomy'] }), qc.invalidateQueries({ queryKey: ['library'] })]); setMessage({ ok: true, text: ok }); return true }
    catch (e) { setMessage({ ok: false, text: e instanceof Error ? e.message : 'تعذر الحفظ' }); return false }
    finally { setBusy(false) }
  }
  if (query.isPending) return <p role="status" className="text-sm text-muted-foreground">جارٍ تحميل التصنيفات…</p>
  if (query.isError) return <p role="alert">تعذر تحميل التصنيفات.</p>
  const d = query.data
  return <div>
    {message && <p role={message.ok ? 'status' : 'alert'} className={`mb-5 rounded-md border p-3 text-sm ${message.ok ? 'border-support bg-accent' : 'border-destructive text-destructive'}`}>{message.text}</p>}
    {section === 'topics' && <Topics rows={d.topics} counts={d.topicCounts} busy={busy} run={run} />}
    {section === 'types' && <Simple title="أنواع الوثائق" rows={d.types} counts={d.typeCounts} busy={busy} run={run} kind="type" />}
    {section === 'tags' && <Simple title="الوسوم" rows={d.tags.map(t => ({ ...t, description: '', sort_order: 0, hidden: false }))} counts={{}} busy={busy} run={run} kind="tag" />}
  </div>
}

type Run = (input: TaxonomyInput, ok: string) => Promise<boolean>

function Topics({ rows, counts, busy, run }: { rows: TopicRow[]; counts: Record<string, number>; busy: boolean; run: Run }) {
  const [draft, setDraft] = useState<TopicDraft | null>(null)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState<Set<string>>(new Set())
  const tree = buildTree(rows)
  const term = search.trim()
  const matches = (n: TopicNode): boolean => n.name.includes(term) || n.description.includes(term) || n.children.some(matches)
  const blocked = draft?.id ? blockedParents(rows, draft.id) : new Set<string>()
  const depthOf = (id: string): number => { const r = rows.find(x => x.id === id); return r?.parent_id ? 1 + depthOf(r.parent_id) : 0 }
  const fresh = (parentId: string | null): TopicDraft => ({ parentId, name: '', description: '', icon: 'BookOpen', sortOrder: rows.filter(r => r.parent_id === parentId).length + 1, hidden: false })
  function Node({ n, level }: { n: TopicNode; level: number }) {
    if (term && !matches(n)) return null
    const Icon = iconFor(n.icon)
    const expanded = Boolean(term) || open.has(n.id)
    return <li>
      <div className="flex flex-wrap items-center gap-2 border-b border-border py-3" style={{ paddingInlineStart: `${level * 1.5}rem` }}>
        {n.children.length ? <Button size="icon" variant="ghost" aria-expanded={expanded} aria-label={expanded ? `طي ${n.name}` : `توسيع ${n.name}`} onClick={() => setOpen(s => { const x = new Set(s); x.has(n.id) ? x.delete(n.id) : x.add(n.id); return x })}>{expanded ? <ChevronDown /> : <ChevronLeft />}</Button> : <span className="inline-block size-9" />}
        <Icon className="size-5 text-support" aria-hidden />
        <span className={`font-bold ${n.hidden ? 'text-muted-foreground line-through' : ''}`}>{n.name}</span>
        {n.hidden && <span className="rounded-full bg-muted px-2 py-0.5 text-xs">مخفي</span>}
        <span className="text-xs text-muted-foreground">{counts[n.id] ? `${counts[n.id]} وثيقة مرتبطة` : 'لا وثائق مرتبطة بعد'} · الترتيب {n.sort_order}</span>
        <span className="ms-auto flex gap-1">
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setDraft(fresh(n.id)); setOpen(s => new Set(s).add(n.id)) }}><Plus />فرعي</Button>
          <Button size="icon" variant="ghost" aria-label={`تعديل ${n.name}`} disabled={busy} onClick={() => setDraft({ id: n.id, parentId: n.parent_id, name: n.name, description: n.description, icon: n.icon, sortOrder: n.sort_order, hidden: n.hidden })}><Pencil /></Button>
          <Button size="icon" variant="ghost" aria-label={n.hidden ? `إظهار ${n.name}` : `إخفاء ${n.name}`} disabled={busy} onClick={() => run({ action: 'topic-save', id: n.id, parentId: n.parent_id, name: n.name, description: n.description, icon: n.icon as TopicDraft['icon'], sortOrder: n.sort_order, hidden: !n.hidden }, n.hidden ? 'تم إظهار الموضوع' : 'تم إخفاء الموضوع')}>{n.hidden ? <Eye /> : <EyeOff />}</Button>
          <Button size="icon" variant="ghost" aria-label={`حذف ${n.name}`} disabled={busy || n.children.length > 0 || Boolean(counts[n.id])} title={n.children.length || counts[n.id] ? 'لا يمكن حذف موضوع له فروع أو وثائق؛ أخفِه' : undefined} onClick={() => { if (window.confirm(`حذف «${n.name}» نهائيًا؟`)) run({ action: 'topic-delete', id: n.id }, 'تم حذف الموضوع') }}><Trash2 /></Button>
        </span>
        {n.description && <p className="w-full ps-11 text-sm text-muted-foreground">{n.description}</p>}
      </div>
      {expanded && n.children.length > 0 && <ul>{n.children.map(c => <Node key={c.id} n={c} level={level + 1} />)}</ul>}
    </li>
  }
  return <section>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">الموضوعات المعرفية</h2><Button disabled={busy} onClick={() => setDraft(fresh(null))}><Plus />موضوع رئيسي</Button></div>
    <p className="mb-5 text-sm text-muted-foreground">الموضوعات تصنّف الوثائق معرفيًا فقط، ولا علاقة لها بالفئات والمجموعات التي تحدد من يطّلع على المحتوى.</p>
    <label className="mb-5 flex max-w-md items-center gap-2"><Search className="size-4" aria-hidden /><span className="sr-only">بحث في الموضوعات</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث في الموضوعات" className="w-full" /></label>
    {draft && <form className="mb-7 grid gap-3 rounded-lg border border-border bg-card p-5 sm:grid-cols-2" onSubmit={async e => { e.preventDefault(); if (await run({ action: 'topic-save', ...draft, icon: draft.icon as TopicDraft['icon'] }, draft.id ? 'تم حفظ التعديل' : 'تمت إضافة الموضوع')) setDraft(null) }}>
      <h3 className="font-bold sm:col-span-2">{draft.id ? 'تعديل موضوع' : draft.parentId ? `موضوع فرعي تحت «${rows.find(r => r.id === draft.parentId)?.name}»` : 'موضوع رئيسي جديد'}</h3>
      <label className="grid gap-1 text-sm">الاسم<input required minLength={2} maxLength={120} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
      <label className="grid gap-1 text-sm">الموضوع الأب<select value={draft.parentId ?? ''} onChange={e => setDraft({ ...draft, parentId: e.target.value || null })}><option value="">— موضوع رئيسي —</option>{rows.filter(r => !blocked.has(r.id)).map(r => <option key={r.id} value={r.id}>{'— '.repeat(depthOf(r.id))}{r.name}</option>)}</select></label>
      <label className="grid gap-1 text-sm sm:col-span-2">الوصف<textarea maxLength={500} rows={2} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} /></label>
      <fieldset className="sm:col-span-2"><legend className="mb-2 text-sm">الأيقونة</legend><div className="flex flex-wrap gap-2">{iconNames.map(name => { const I = iconFor(name); return <button type="button" key={name} aria-label={name} aria-pressed={draft.icon === name} onClick={() => setDraft({ ...draft, icon: name })} className={`rounded-md border p-2 ${draft.icon === name ? 'border-primary bg-accent' : 'border-border'}`}><I className="size-5" /></button> })}</div></fieldset>
      <label className="grid gap-1 text-sm">ترتيب الظهور<input type="number" min={0} max={10000} value={draft.sortOrder} onChange={e => setDraft({ ...draft, sortOrder: Number(e.target.value) })} /></label>
      <label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" checked={draft.hidden} onChange={e => setDraft({ ...draft, hidden: e.target.checked })} />مخفي من المكتبة</label>
      <div className="flex gap-2 sm:col-span-2"><Button disabled={busy}>{busy ? 'جارٍ الحفظ…' : 'حفظ'}</Button><Button type="button" variant="ghost" onClick={() => setDraft(null)}>إلغاء</Button></div>
    </form>}
    {tree.length ? <ul>{tree.map(n => <Node key={n.id} n={n} level={0} />)}</ul> : <p className="text-sm text-muted-foreground">لا توجد موضوعات بعد.</p>}
  </section>
}

type SimpleRow = { id: string; name: string; description: string; sort_order: number; hidden: boolean }
function Simple({ title, rows, counts, busy, run, kind }: { title: string; rows: SimpleRow[]; counts: Record<string, number>; busy: boolean; run: Run; kind: 'type' | 'tag' }) {
  const [draft, setDraft] = useState<SimpleRow & { id: string } | null>(null)
  const [search, setSearch] = useState('')
  const submit = (r: SimpleRow & { id: string }, ok: string) => run(kind === 'type' ? { action: 'type-save', ...(r.id ? { id: r.id } : {}), name: r.name, description: r.description, sortOrder: r.sort_order, hidden: r.hidden } : { action: 'tag-save', ...(r.id ? { id: r.id } : {}), name: r.name }, ok)
  const list = rows.filter(r => r.name.includes(search.trim()))
  return <section>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">{title}</h2><Button disabled={busy} onClick={() => setDraft({ id: '', name: '', description: '', sort_order: rows.length + 1, hidden: false })}><Plus />{kind === 'type' ? 'نوع جديد' : 'وسم جديد'}</Button></div>
    <label className="mb-5 flex max-w-md items-center gap-2"><Search className="size-4" aria-hidden /><span className="sr-only">بحث</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث" className="w-full" /></label>
    {draft && <form className="mb-7 grid gap-3 rounded-lg border border-border bg-card p-5 sm:grid-cols-2" onSubmit={async e => { e.preventDefault(); if (await submit(draft, draft.id ? 'تم حفظ التعديل' : 'تمت الإضافة')) setDraft(null) }}>
      <label className="grid gap-1 text-sm">الاسم<input required minLength={2} maxLength={120} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
      {kind === 'type' && <>
        <label className="grid gap-1 text-sm">ترتيب الظهور<input type="number" min={0} max={10000} value={draft.sort_order} onChange={e => setDraft({ ...draft, sort_order: Number(e.target.value) })} /></label>
        <label className="grid gap-1 text-sm sm:col-span-2">الوصف<textarea maxLength={500} rows={2} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.hidden} onChange={e => setDraft({ ...draft, hidden: e.target.checked })} />مخفي</label>
      </>}
      <div className="flex gap-2 sm:col-span-2"><Button disabled={busy}>{busy ? 'جارٍ الحفظ…' : 'حفظ'}</Button><Button type="button" variant="ghost" onClick={() => setDraft(null)}>إلغاء</Button></div>
    </form>}
    {list.length ? <ul>{list.map(r => <li key={r.id} className="flex flex-wrap items-center gap-2 border-b border-border py-3">
      <span className={`font-bold ${r.hidden ? 'text-muted-foreground line-through' : ''}`}>{r.name}</span>
      {r.hidden && <span className="rounded-full bg-muted px-2 py-0.5 text-xs">مخفي</span>}
      {kind === 'type' && <span className="text-xs text-muted-foreground">{counts[r.id] ? `${counts[r.id]} وثيقة` : 'غير مستخدم بعد'} · الترتيب {r.sort_order}</span>}
      <span className="ms-auto flex gap-1">
        <Button size="icon" variant="ghost" aria-label={`تعديل ${r.name}`} disabled={busy} onClick={() => setDraft(r)}><Pencil /></Button>
        {kind === 'type' && <Button size="icon" variant="ghost" aria-label={r.hidden ? `إظهار ${r.name}` : `إخفاء ${r.name}`} disabled={busy} onClick={() => submit({ ...r, hidden: !r.hidden }, r.hidden ? 'تم الإظهار' : 'تم الإخفاء')}>{r.hidden ? <Eye /> : <EyeOff />}</Button>}
        <Button size="icon" variant="ghost" aria-label={`حذف ${r.name}`} disabled={busy || Boolean(counts[r.id])} onClick={() => { if (window.confirm(`حذف «${r.name}» نهائيًا؟`)) run({ action: kind === 'type' ? 'type-delete' : 'tag-delete', id: r.id }, 'تم الحذف') }}><Trash2 /></Button>
      </span>
      {r.description && <p className="w-full text-sm text-muted-foreground">{r.description}</p>}
    </li>)}</ul> : <p className="text-sm text-muted-foreground">{rows.length ? 'لا نتائج مطابقة.' : kind === 'tag' ? 'لا توجد وسوم بعد.' : 'لا توجد أنواع بعد.'}</p>}
  </section>
}
