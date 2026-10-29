import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { FileText, Download, Eye, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { formatLabels, type FormatKind } from './document-rules'
import { deliverBlob, requestDocumentFile, responseFilename } from './delivery'
import { PdfPreview } from './PdfPreview'

// Reader requests carry only the Watheq document id and a format kind, never a Drive reference.
export function FormatButtons({ formats, title, documentId }: { formats: string[]; title: string; documentId: string }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  const [preview, setPreview] = useState<Blob | null>(null)
  const [download, setDownload] = useState<{ blob: Blob; filename: string } | null>(null)
  const [retryId, setRetryId] = useState<string | null>(null)
  const pending = useRef<AbortController | null>(null)
  const qc = useQueryClient()
  useEffect(() => {
    setSelected(null); setPreview(null); setDownload(null); setRetryId(null)
    return () => { pending.current?.abort() }
  }, [documentId])
  function close() {
    pending.current?.abort(); pending.current = null
    setSelected(null); setPreview(null); setDownload(null); setRetryId(null); setBusy(false); setError('')
  }
  async function prepare(action: 'download' | 'preview') {
    if (!selected || busy) return
    if (action === 'preview' && preview) return
    const controller = new AbortController()
    pending.current?.abort(); pending.current = controller
    const requestId = action === 'download' ? retryId ?? crypto.randomUUID() : crypto.randomUUID()
    if (action === 'download') setRetryId(requestId)
    setBusy(true); setError('')
    try {
      if (action === 'preview') performance.mark('watheq-preview-request')
      const res = await requestDocumentFile(documentId, action, requestId, selected, controller.signal)
      const blob = await res.blob()
      if (controller.signal.aborted || pending.current !== controller) return
      if (action === 'preview') { performance.mark('watheq-preview-blob'); setPreview(blob) }
      else {
        setDownload({ blob, filename: responseFilename(res, title) })
        await qc.invalidateQueries({ predicate: q => ['document-usage'].includes(String(q.queryKey[0])) })
      }
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'تعذر تجهيز الملف') }
    finally { if (pending.current === controller) { pending.current = null; setBusy(false) } }
  }
  if (!formats.length) return <span className="text-xs text-muted-foreground">لا توجد صيغ</span>
  return <div className="flex flex-wrap items-center gap-2">
    {formats.map(f => <Button key={f} type="button" size="sm" variant="outline" aria-label={`${formatLabels[f as FormatKind] ?? f} — ${title}`} onClick={e => { e.stopPropagation(); close(); setSelected(f) }}><FileText />{formatLabels[f as FormatKind] ?? f}</Button>)}
    <Dialog open={selected !== null} onOpenChange={open => { if (!open) close() }}>
      <DialogContent dir="rtl" className="max-h-[90dvh] max-w-3xl overflow-y-auto">
        <DialogTitle className="pe-6">{title} — {selected ? formatLabels[selected as FormatKind] : ''}</DialogTitle>
        <DialogDescription>{selected === 'pdf' ? 'PDF' : 'المعاينة غير مدعومة لهذه الصيغة'}</DialogDescription>
        {error && <p role="alert" className="text-sm text-destructive">{error} أعد المحاولة باستخدام الزر أدناه.</p>}
        {busy && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 motion-safe:animate-spin" />جارٍ جلب الملف والتحقق من إتاحته…</p>}
        <div className="flex flex-wrap items-center gap-2">
          {selected === 'pdf' && <Button size="sm" variant="outline" disabled={busy || preview !== null} onClick={() => prepare('preview')}><Eye />معاينة</Button>}
          {download ? <Button size="sm" onClick={() => deliverBlob(download.blob, download.filename)}><Download />تنزيل الملف</Button> : <Button size="sm" disabled={busy} onClick={() => prepare('download')}><Download />{busy ? 'جارٍ التجهيز…' : 'تجهيز التنزيل'}</Button>}
        </div>
        {preview && <PdfPreview blob={preview} />}
      </DialogContent>
    </Dialog>
  </div>
}
