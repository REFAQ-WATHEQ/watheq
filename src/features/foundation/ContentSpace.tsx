import { Link, useHydrated } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { useEffect, useState } from 'react'
import { Download, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/integrations/supabase/client'
import { listContent, readContent } from './content.functions'
import { Shell, PageTitle } from './Shell'

function useVisitor() {
  const hydrated = useHydrated()
  const [identity, setIdentity] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => { if (active) setIdentity(data.session?.user.id ?? 'anonymous') })
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setIdentity(session?.user.id ?? 'anonymous'))
    return () => { active = false; data.subscription.unsubscribe() }
  }, [])
  return hydrated ? identity : null
}
export function ContentResults({ kind, search = '' }: { kind?: string; search?: string }) {
  const identity = useVisitor()
  const list = useServerFn(listContent)
  const query = useQuery({ queryKey: ['content', identity, kind, search], queryFn: () => list({ data: { ...(kind ? { kind } : {}), search } }), enabled: identity !== null, staleTime: 0, gcTime: 0 })
  if (!identity || query.isPending) return <p role="status" className="text-sm text-muted-foreground">جارٍ تحميل المحتوى…</p>
  if (query.isError) return <p role="alert" className="text-sm">تعذر تحميل المحتوى.</p>
  return query.data.length ? <ul className="grid gap-5 sm:grid-cols-2">{query.data.map(item => <li key={item.id} className="border-b border-border py-5"><Link to="/content/$id" params={{ id: item.id }} className="font-bold underline underline-offset-4">{item.title}</Link><p className="mt-2 text-sm text-muted-foreground">{item.summary}</p></li>)}</ul> : <p className="text-sm text-muted-foreground">لا توجد محتويات متاحة حاليًا.</p>
}
export function ContentSpace({ title, kind }: { title: string; kind: string }) {
  return <Shell><PageTitle title={title} subtitle="من مكونات منصة وثيق المعرفية"/><section className="site-width py-16"><BookOpen className="mb-5 size-10 text-support" strokeWidth={1}/><ContentResults kind={kind}/></section></Shell>
}
export function ContentDetail({ id }: { id: string }) {
  const identity = useVisitor()
  const read = useServerFn(readContent)
  const [message, setMessage] = useState('')
  const query = useQuery({ queryKey: ['content-detail', identity, id], queryFn: () => read({ data: { id } }), enabled: identity !== null, staleTime: 0, gcTime: 0 })
  async function download(fileId: string, name: string) {
    setMessage('')
    const { data } = await supabase.auth.getSession()
    const response = await fetch(`/api/public/content-files/${fileId}`, { method: 'POST', headers: data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}, cache: 'no-store' })
    if (!response.ok) { setMessage('الملف غير متاح أو ليس لديك صلاحية الوصول إليه.'); return }
    const url = URL.createObjectURL(await response.blob())
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <Shell><PageTitle title={query.data?.title ?? 'المحتوى'} subtitle="منصة وثيق المعرفية"/><section className="site-width py-12">{!identity || query.isPending ? <p role="status">جارٍ التحميل…</p> : query.isError || !query.data ? <p role="alert">المحتوى غير متاح أو ليس لديك صلاحية الوصول إليه.</p> : <><p className="mb-7 text-muted-foreground">{query.data.summary}</p><div className="whitespace-pre-wrap leading-8">{query.data.body}</div><div className="mt-8 flex flex-wrap gap-3">{query.data.files.map(file => <Button key={file.id} variant="outline" onClick={() => download(file.id, file.file_name).catch(() => setMessage('تعذر تحميل الملف'))}><Download/>{file.file_name}</Button>)}</div></>}{message && <p role="alert" className="mt-4">{message}</p>}</section></Shell>
}
