import {useState} from 'react'
import {useSuspenseQuery,useQueryClient} from '@tanstack/react-query'
import {useServerFn} from '@tanstack/react-start'
import {UserPlus,ShieldCheck,ShieldMinus} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {platformAdminsQuery} from './queries'
import {changeRole} from './functions'
import {roleLabels,canRevokeAdmin} from './rules'

export function PlatformAdmins({currentUserId}:{currentUserId:string}){
 const {data}=useSuspenseQuery(platformAdminsQuery)
 const qc=useQueryClient();const change=useServerFn(changeRole)
 const [selected,setSelected]=useState('');const [busy,setBusy]=useState(false);const [message,setMessage]=useState('')
 const [pending,setPending]=useState<{userId:string,role:'admin'|'supervisor'|'user'}|null>(null)
 const [replacement,setReplacement]=useState<'user'|'supervisor'>('user')
 const admins=data.directory.filter(p=>p.is_admin);const candidates=data.directory.filter(p=>!p.is_admin&&p.eligible)
 const target=data.directory.find(p=>p.user_id===pending?.userId)
 async function confirm(){if(!pending)return;setBusy(true);setMessage('');try{
  await change({data:pending});setPending(null);setSelected('');
  await Promise.all([qc.invalidateQueries({queryKey:['platform-admins']}),qc.invalidateQueries({queryKey:['admin']}),qc.invalidateQueries({queryKey:['account']})]);
  setMessage('تم تحديث صلاحيات الحساب وتسجيل العملية')
 }catch(e){setMessage(e instanceof Error?e.message:'تعذر تحديث الصلاحيات')}finally{setBusy(false)}}
 return <div><h2 className="mb-5 flex items-center gap-2 text-xl font-bold"><ShieldCheck/>مديرو المنصة</h2>
 <div className="divide-y divide-border">{admins.map(p=><div key={p.user_id} className="flex flex-wrap items-center justify-between gap-4 py-4"><div><p className="font-semibold">{p.full_name}</p><p dir="ltr" className="mt-1 break-all text-sm text-muted-foreground">{p.email}</p><p className="mt-1 text-sm">{p.eligible?'نشط':'غير مؤهل حاليًا'}{p.user_id===currentUserId?' · حسابك':''}</p></div><Button variant="outline" disabled={busy||!canRevokeAdmin(admins,p.user_id,currentUserId)} onClick={()=>{setReplacement('user');setPending({userId:p.user_id,role:'user'});setMessage('')}}><ShieldMinus/>إلغاء صلاحية المدير</Button></div>)}</div>
 {!admins.length&&<p className="text-muted-foreground">لا يوجد مديرون حاليًا.</p>}
 <form className="mt-8 flex max-w-2xl flex-wrap items-end gap-3 border-t border-border pt-6" onSubmit={e=>{e.preventDefault();if(selected){setPending({userId:selected,role:'admin'});setMessage('')}}}><div className="min-w-0 flex-1"><label htmlFor="new-platform-admin">تعيين مدير جديد</label><select id="new-platform-admin" required value={selected} disabled={busy} onChange={e=>setSelected(e.target.value)}><option value="">اختر حسابًا مؤكدًا ونشطًا</option>{candidates.map(p=><option key={p.user_id} value={p.user_id}>{p.full_name} — {p.email}</option>)}</select></div><Button disabled={busy||!selected}><UserPlus/>تعيين مدير</Button></form>
 {pending&&target&&<section aria-label="تأكيد تغيير صلاحيات المدير" className="mt-6 border-s-2 border-primary ps-5"><h3 className="font-bold">{pending.role==='admin'?'تأكيد تعيين مدير المنصة':'تأكيد إلغاء صلاحية المدير'}</h3><p className="mt-3">{target.full_name}</p><p dir="ltr" className="my-2 break-all text-sm">{target.email}</p>{pending.role!=='admin'&&<div className="my-4 max-w-sm"><label htmlFor="admin-replacement-role">الدور بعد الإلغاء</label><select id="admin-replacement-role" value={replacement} disabled={busy} onChange={e=>{const role=e.target.value==='supervisor'?'supervisor':'user';setReplacement(role);setPending({...pending,role})}}><option value="user">مستخدم</option><option value="supervisor">مشرف</option></select></div>}<div className="mt-4 flex gap-3"><Button type="button" disabled={busy} onClick={confirm}><ShieldCheck/>{busy?'جارٍ الحفظ…':'تأكيد'}</Button><Button type="button" variant="outline" disabled={busy} onClick={()=>setPending(null)}>إلغاء</Button></div></section>}
 {message&&<p role="status" className="mt-5 text-sm">{message}</p>}
 <h3 className="mb-5 mt-10 border-t border-border pt-7 text-lg font-bold">سجل تعيين المديرين وإلغاء صلاحياتهم</h3>
 <div className="overflow-x-auto"><table className="w-full text-start text-sm"><thead><tr>{['الوقت','المنفذ','الحساب','الدور السابق','الدور الجديد'].map(t=><th key={t} className="p-3 text-start">{t}</th>)}</tr></thead><tbody>{data.audit.map(row=><tr key={row.id} className="border-t border-border"><td className="whitespace-nowrap p-3">{new Date(row.created_at).toLocaleString('ar-SA',{timeZone:'Asia/Riyadh'})}</td><td className="p-3">{data.directory.find(p=>p.user_id===row.actor_id)?.full_name||(row.actor_id?'حساب سابق':'إجراء مالك قاعدة البيانات')}</td><td className="p-3">{data.directory.find(p=>p.user_id===row.target_user)?.full_name||'حساب سابق'}</td><td className="p-3">{row.old_role?roleLabels[row.old_role]:'—'}</td><td className="p-3">{row.new_role?roleLabels[row.new_role]:'—'}</td></tr>)}</tbody></table></div>{!data.audit.length&&<p className="mt-3 text-sm text-muted-foreground">لا توجد عمليات مسجلة بعد.</p>}
 </div>
}
