import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { Plus, Pencil, Archive, RotateCcw, Send, Search, X, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { audienceLabels } from '@/features/foundation/access-rules'
import { listDocumentsAdmin, saveDocument, setDocumentStatus, verifyFormat } from './documents.functions'
import { formatLabels, parseDriveLink, statusLabels, type DocumentInput, type FormatKind } from './document-rules'
import { DocumentEvents } from './DocumentEvents'

type Data = Awaited<ReturnType<typeof listDocumentsAdmin>>
type Doc = Data['documents'][number]
type FormatRow = { format: FormatKind; link: string; label: string }
const driveUrl = (id: string) => `https://drive.google.com/file/d/${id}/view`

export function DocumentAdmin() {
  const load = useServerFn(listDocumentsAdmin)
  const q = useQuery({ queryKey: ['documents-admin'], queryFn: () => load() })
  const [editing, setEditing] = useState<Doc | 'new' | null>(null)
  const [search, setSearch] = useState(''); const [status, setStatus] = useState(''); const [topic, setTopic] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const qc = useQueryClient(); const change = useServerFn(setDocumentStatus); const verify = useServerFn(verifyFormat)
  const [checking, setChecking] = useState<string | null>(null)
  async function check(formatId: string) {
    setChecking(formatId); setMsg(null)
    try { const r = await verify({ data: { formatId } }); await qc.invalidateQueries({ queryKey: ['documents-admin'] }); setMsg({ ok: r.ok, text: r.ok ? `نجح التحقق: ${r.reason}` : `فشل التحقق: ${r.reason}` }) }
    catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'تعذر التحقق' }) } finally { setChecking(null) }
  }
  const list = useMemo(() => (q.data?.documents ?? []).filter(d => (!search || d.title.includes(search.trim())) && (!status || d.status === status) && (!topic || d.topicIds.includes(topic))), [q.data, search, status, topic])
  if (q.isPending) return <p role="status" className="text-sm text-muted-foreground">جارٍ تحميل الوثائق…</p>
  if (q.isError) return <p role="alert">تعذر تحميل الوثائق.</p>
  const d = q.data
  const name = (rows: { id: string; name: string }[], id: string | null) => rows.find(r => r.id === id)?.name ?? '—'
  async function setState(doc: Doc, s: 'draft' | 'published' | 'archived') {
    setMsg(null)
    try { await change({ data: { id: doc.id, status: s } }); await qc.invalidateQueries({ queryKey: ['documents-admin'] }); setMsg({ ok: true, text: `أصبحت الوثيقة: ${statusLabels[s]}` }) }
    catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'تعذر تغيير الحالة' }) }
  }
  if (editing) return <DocumentForm data={d} doc={editing === 'new' ? null : editing} onDone={async text => { setEditing(null); if (text) { await qc.invalidateQueries({ queryKey: ['documents-admin'] }); setMsg({ ok: true, text }) } }} />
  return <div>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">الوثائق</h2><Button onClick={() => { setMsg(null); setEditing('new') }}><Plus />وثيقة جديدة</Button></div>
    {!d.driveConfigured && <p className="mb-3 rounded-md border border-destructive p-3 text-sm">لم يكتمل إعداد اتصال Google Drive بعد؛ زر «التحقق من الملف» معطّل حتى إدخال بيانات حساب الخدمة ومعرّفات مجلدات المكتبة.</p>}
    {msg && <p role={msg.ok ? 'status' : 'alert'} className={`mb-5 rounded-md border p-3 text-sm ${msg.ok ? 'border-support bg-accent' : 'border-destructive text-destructive'}`}>{msg.text}</p>}
    <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_180px_220px]">
      <label className="relative"><Search className="absolute start-3 top-3 size-4 text-muted-foreground" /><input className="w-full ps-9" aria-label="بحث في الوثائق" placeholder="ابحث بالعنوان" value={search} onChange={e => setSearch(e.target.value)} /></label>
      <select aria-label="تصفية بالحالة" value={status} onChange={e => setStatus(e.target.value)}><option value="">كل الحالات</option>{Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      <select aria-label="تصفية بالموضوع" value={topic} onChange={e => setTopic(e.target.value)}><option value="">كل الموضوعات</option>{d.topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
    </div>
    {!d.documents.length ? <p className="text-sm text-muted-foreground">لا توجد وثائق بعد.</p> : !list.length ? <p className="text-sm text-muted-foreground">لا توجد نتائج مطابقة.</p> :
      <div className="overflow-x-auto"><table className="w-full text-start text-sm"><thead className="border-b border-border"><tr>{['العنوان', 'الموضوعات', 'النوع', 'الحالة', 'الصيغ', 'الإتاحة', 'آخر تحديث', ''].map(h => <th key={h} className="p-2 text-start">{h}</th>)}</tr></thead><tbody>
        {list.map(doc => <tr key={doc.id} className="border-b border-border align-top">
          <td className="p-2 font-semibold">{doc.title}<DocumentEvents id={doc.id} /></td>
          <td className="p-2">{doc.topicIds.map(id => name(d.topics, id)).join('، ') || '—'}</td>
          <td className="p-2">{name(d.types, doc.document_type_id)}</td>
          <td className="p-2">{statusLabels[doc.status]}</td>
          <td className="p-2">{doc.formats.length ? <ul className="grid gap-2">{doc.formats.map(f => <li key={f.id} className="min-w-48"><div className="flex items-center gap-2"><strong>{formatLabels[f.format as FormatKind] ?? f.format}</strong><VerifyBadge f={f} /></div>{f.reason && <p className="text-xs text-muted-foreground">{f.reason}{f.verifiedSize ? ` · ${(f.verifiedSize / 1048576).toFixed(1)} ميغابايت` : ''}</p>}{f.verifiedAt && <p className="text-xs text-muted-foreground">آخر تحقق: {new Date(f.verifiedAt).toLocaleString('ar-SA')}</p>}<Button size="sm" variant="ghost" disabled={!d.driveConfigured || checking === f.id} title={d.driveConfigured ? '' : 'لم يكتمل إعداد اتصال Google Drive'} onClick={() => check(f.id)}><ShieldCheck />{checking === f.id ? 'جارٍ التحقق…' : 'التحقق من الملف'}</Button></li>)}</ul> : '—'}</td>
          <td className="p-2">{audienceLabels[doc.audience]}</td>
          <td className="p-2 whitespace-nowrap">{new Date(doc.updated_at).toLocaleDateString('ar-SA')}</td>
          <td className="p-2"><div className="flex flex-wrap gap-1">
            <Button size="sm" variant="ghost" onClick={() => { setMsg(null); setEditing(doc) }}><Pencil />تعديل</Button>
            {doc.status === 'draft' && <Button size="sm" variant="ghost" onClick={() => setState(doc, 'published')}><Send />نشر</Button>}
            {doc.status !== 'archived' && <Button size="sm" variant="ghost" onClick={() => setState(doc, 'archived')}><Archive />أرشفة</Button>}
            {doc.status !== 'draft' && <Button size="sm" variant="ghost" onClick={() => setState(doc, 'draft')}><RotateCcw />إعادة إلى مسودة</Button>}
          </div></td>
        </tr>)}
      </tbody></table></div>}
  </div>
}

function DocumentForm({ data, doc, onDone }: { data: Data; doc: Doc | null; onDone: (text?: string) => void }) {
  const save = useServerFn(saveDocument)
  const [title, setTitle] = useState(doc?.title ?? ''); const [summary, setSummary] = useState(doc?.summary ?? '')
  const [typeId, setType] = useState(doc?.document_type_id ?? ''); const [topics, setTopics] = useState(doc?.topicIds ?? []); const [tags, setTags] = useState(doc?.tagIds ?? [])
  const [audience, setAudience] = useState<DocumentInput['audience']>(doc?.audience ?? 'registered')
  const [cats, setCats] = useState(doc?.categoryIds ?? []); const [groups, setGroups] = useState(doc?.groupIds ?? [])
  const [formats, setFormats] = useState<FormatRow[]>(doc?.formats.map(f => ({ format: f.format as FormatKind, link: driveUrl(f.driveFileId), label: f.label })) ?? [])
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  const toggle = (list: string[], set: (v: string[]) => void, id: string, on: boolean) => set(on ? [...list, id] : list.filter(x => x !== id))
  const unused = (Object.keys(formatLabels) as FormatKind[]).filter(k => !formats.some(f => f.format === k))
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError('')
    const parsed = formats.map(f => ({ f, r: parseDriveLink(f.link) }))
    const bad = parsed.find(p => !p.r.ok)
    if (bad && !bad.r.ok) return setError(`رابط ${formatLabels[bad.f.format]}: ${bad.r.error}`)
    if (!topics.length) return setError('اختر موضوعًا معرفيًا واحدًا على الأقل')
    if (audience === 'targeted' && !cats.length && !groups.length) return setError('اختر فئة أو مجموعة')
    setBusy(true)
    try {
      await save({ data: { id: doc?.id, title, summary, typeId: typeId || null, topicIds: topics, tagIds: tags, audience, categoryIds: audience === 'targeted' ? cats : [], groupIds: audience === 'targeted' ? groups : [],
        formats: parsed.map(p => ({ format: p.f.format, driveFileId: p.r.ok ? p.r.id : '', label: p.f.label })) } })
      onDone(doc ? 'تم حفظ التعديلات' : 'تم حفظ الوثيقة كمسودة')
    } catch (err) { setError(err instanceof Error ? err.message : 'تعذر الحفظ') } finally { setBusy(false) }
  }
  const box = (rows: { id: string; name: string }[], sel: string[], set: (v: string[]) => void, label: string) => <fieldset className="max-h-56 overflow-y-auto rounded-md border border-border p-3"><legend className="px-1 font-semibold">{label}</legend>{rows.length ? rows.map(r => <label key={r.id} className="mb-2 flex items-center gap-2 text-sm"><Checkbox checked={sel.includes(r.id)} onCheckedChange={c => toggle(sel, set, r.id, c === true)} />{r.name}</label>) : <p className="text-sm text-muted-foreground">لا توجد عناصر.</p>}</fieldset>
  return <form onSubmit={submit} className="grid max-w-4xl gap-5">
    <div className="flex items-center justify-between"><h2 className="text-xl font-bold">{doc ? 'تعديل وثيقة' : 'وثيقة جديدة'}</h2><Button type="button" variant="ghost" onClick={() => onDone()}><X />إلغاء</Button></div>
    {error && <p role="alert" className="rounded-md border border-destructive p-3 text-sm text-destructive">{error}</p>}
    <label className="grid gap-2">العنوان<input value={title} onChange={e => setTitle(e.target.value)} required minLength={3} maxLength={250} /></label>
    <label className="grid gap-2">الوصف<textarea rows={4} value={summary} onChange={e => setSummary(e.target.value)} maxLength={3000} /></label>
    <label className="grid gap-2">نوع الوثيقة<select value={typeId} onChange={e => setType(e.target.value)}><option value="">بدون نوع (مطلوب للنشر)</option>{data.types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
    <div className="grid gap-4 sm:grid-cols-2">{box(data.topics, topics, setTopics, 'الموضوعات المعرفية *')}{box(data.tags, tags, setTags, 'الوسوم')}</div>
    <label className="grid gap-2">الجمهور المستهدف<select value={audience} onChange={e => setAudience(e.target.value as DocumentInput['audience'])}>{Object.entries(audienceLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
    {audience === 'targeted' && <div className="grid gap-4 sm:grid-cols-2">{box(data.categories, cats, setCats, 'الفئات')}{box(data.groups, groups, setGroups, 'المجموعات')}</div>}
    <fieldset className="rounded-md border border-border p-4"><legend className="px-1 font-semibold">صيغ الوثيقة وروابط Google Drive</legend>
      <p className="mb-3 text-xs text-muted-foreground">نتحقق الآن من بنية الرابط فقط. التحقق من وجود الملف وصلاحية الوصول إليه يتم بعد ربط Google Drive.</p>
      {formats.map((f, i) => { const r = f.link ? parseDriveLink(f.link) : null; return <div key={f.format} className="mb-4 grid gap-2 border-b border-border pb-4 sm:grid-cols-[110px_1fr_160px_auto]">
        <strong className="pt-2">{formatLabels[f.format]}</strong>
        <div><input aria-label={`رابط ${formatLabels[f.format]}`} dir="ltr" className="w-full" placeholder="https://drive.google.com/file/d/…/view" value={f.link} onChange={e => setFormats(formats.map((x, j) => j === i ? { ...x, link: e.target.value } : x))} />
          {r && <p className={`mt-1 text-xs ${r.ok ? 'text-muted-foreground' : 'text-destructive'}`}>{r.ok ? 'بنية الرابط صحيحة — لم يُتحقق من وجود الملف بعد' : r.error}</p>}</div>
        <input aria-label={`وصف ${formatLabels[f.format]}`} placeholder="وصف اختياري" value={f.label} onChange={e => setFormats(formats.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
        <Button type="button" variant="ghost" size="icon" aria-label={`إزالة ${formatLabels[f.format]}`} onClick={() => setFormats(formats.filter((_, j) => j !== i))}><X /></Button>
      </div> })}
      {unused.length > 0 && <div className="flex flex-wrap gap-2">{unused.map(k => <Button key={k} type="button" variant="outline" size="sm" onClick={() => setFormats([...formats, { format: k, link: '', label: '' }])}><Plus />{formatLabels[k]}</Button>)}</div>}
    </fieldset>
    <div><Button disabled={busy}>{busy ? 'جارٍ الحفظ…' : doc ? 'حفظ التعديلات' : 'حفظ كمسودة'}</Button></div>
  </form>
}

function VerifyBadge({ f }: { f: { verifyStatus: string } }) {
  const map: Record<string, [string, string]> = { ok: ['تم التحقق', 'bg-accent'], failed: ['فشل التحقق', 'border border-destructive text-destructive'], unverified: ['بنية الرابط صحيحة — لم يُتحقق', 'bg-muted text-muted-foreground'] }
  const [label, cls] = map[f.verifyStatus] ?? map['unverified']!
  return <span className={`rounded-full px-2 py-0.5 text-xs ${cls}`}>{label}</span>
}
