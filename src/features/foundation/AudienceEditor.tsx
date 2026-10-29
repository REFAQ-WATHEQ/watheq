import { useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { useQueryClient } from '@tanstack/react-query'
import { Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { audienceLabels } from './access-rules'
import { saveContentAudience } from './content.functions'
type Option = { id: string; name: string }
export function AudienceEditor({ item, categories, groups, initialCategories, initialGroups }: { item: { id: string; title: string; audience: keyof typeof audienceLabels }; categories: Option[]; groups: Option[]; initialCategories: string[]; initialGroups: string[] }) {
  const [audience, setAudience] = useState(item.audience)
  const [categoryIds, setCategories] = useState(initialCategories)
  const [groupIds, setGroups] = useState(initialGroups)
  const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false)
  const save = useServerFn(saveContentAudience); const qc = useQueryClient()
  async function refreshAccess() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['admin'] }),
      qc.invalidateQueries({ queryKey: ['content'] }),
      qc.invalidateQueries({ queryKey: ['content-detail'] }),
    ])
  }
  return <form className="border-b border-border py-6" onSubmit={async e => { e.preventDefault(); setBusy(true); setMessage(''); try { await save({ data: { contentId: item.id, audience, categoryIds, groupIds } }); await refreshAccess(); setMessage('تم حفظ الإتاحة') } catch { setMessage('تعذر الحفظ؛ اختر فئة أو مجموعة عند تخصيص المحتوى') } finally { setBusy(false) } }}><h3 className="mb-4 font-bold">{item.title}</h3><label className="grid max-w-md gap-2">إتاحة المحتوى<select aria-label={`إتاحة ${item.title}`} value={audience} onChange={e => setAudience(e.target.value as keyof typeof audienceLabels)}>{Object.entries(audienceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{audience === 'targeted' && <div className="my-5 grid gap-5 sm:grid-cols-2">{[{ name: 'الفئات', options: categories, selected: categoryIds, set: setCategories }, { name: 'المجموعات', options: groups, selected: groupIds, set: setGroups }].map(section => <fieldset key={section.name}><legend className="mb-3 font-semibold">{section.name}</legend>{section.options.map(option => <label key={option.id} className="mb-3 flex items-center gap-3"><Checkbox checked={section.selected.includes(option.id)} onCheckedChange={checked => section.set(previous => checked === true ? [...previous, option.id] : previous.filter(id => id !== option.id))}/>{option.name}</label>)}</fieldset>)}</div>}<Button className="mt-4" disabled={busy}><Save/>حفظ الإتاحة</Button>{message && <p role="status" className="mt-3 text-sm">{message}</p>}</form>
}
