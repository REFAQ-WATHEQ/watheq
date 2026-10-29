import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize, RotateCw, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { PDFDocumentProxy, TextLayer } from 'pdfjs-dist'
import { boundedZoom, pdfOutputScale } from './pdf-render-rules'
import './pdf-preview.css'

export function PdfPreview({ blob }: { blob: Blob }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const sheet = useRef<HTMLDivElement>(null)
  const text = useRef<HTMLDivElement>(null)
  const rendering = useRef<Promise<unknown>>(Promise.resolve())
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [page, setPage] = useState(1)
  const [width, setWidth] = useState(300)
  const [zoom, setZoom] = useState(1)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let disposed = false
    let destroy: (() => void) | undefined
    setPdf(null); setPage(1); setError(''); setLoading(true)
    void (async () => {
      const lib = await import('pdfjs-dist')
      const data = await blob.arrayBuffer()
      if (disposed) return
      lib.GlobalWorkerOptions.workerSrc = workerUrl
      const resources = new URL('/pdfjs/4.10.38/', window.location.origin).href
      const task = lib.getDocument({ data, isEvalSupported: false, disableFontFace: true, cMapUrl: `${resources}cmaps/`, cMapPacked: true, standardFontDataUrl: `${resources}standard_fonts/` })
      destroy = () => { void task.destroy() }
      const doc = await task.promise
      if (!disposed) performance.mark('watheq-preview-document')
      if (!disposed) setPdf(doc)
    })().catch(() => { if (!disposed) { setError('تعذر فتح PDF؛ قد يكون محميًا بكلمة مرور أو غير صالح.'); setLoading(false) } })
    return () => { disposed = true; destroy?.() }
  }, [blob, retry])
  useEffect(() => {
    const el = box.current
    if (!el) return
    let timer: ReturnType<typeof setTimeout>
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      clearTimeout(timer)
      const value = Math.max(180, Math.floor(entry.contentRect.width))
      timer = setTimeout(() => setWidth(w => w === value ? w : value), 100)
    })
    observer.observe(el)
    return () => { clearTimeout(timer); observer.disconnect() }
  }, [])
  useEffect(() => {
    if (!pdf) return
    let disposed = false
    let cancel: (() => void) | undefined
    let layer: TextLayer | undefined
    setLoading(true); setError('')
    void (async () => {
      await rendering.current.catch(() => undefined)
      if (disposed) return
      const p = await pdf.getPage(page)
      const lib = await import('pdfjs-dist')
      if (disposed || !canvas.current || !sheet.current || !text.current) return
      const viewport = p.getViewport({ scale: width / p.getViewport({ scale: 1 }).width * zoom })
      const output = pdfOutputScale(viewport.width, viewport.height, window.devicePixelRatio)
      const el = canvas.current
      const context = el.getContext('2d')
      if (!context) throw new Error('Canvas unavailable')
      sheet.current.style.width = `${viewport.width}px`; sheet.current.style.height = `${viewport.height}px`
      sheet.current.style.setProperty('--scale-factor', String(viewport.scale))
      el.width = Math.floor(viewport.width * output); el.height = Math.floor(viewport.height * output)
      el.style.width = `${viewport.width}px`; el.style.height = `${viewport.height}px`
      text.current.replaceChildren()
      const task = p.render({ canvasContext: context, viewport, transform: [output, 0, 0, output, 0, 0] })
      layer = new lib.TextLayer({ container: text.current, viewport, textContentSource: p.streamTextContent() })
      cancel = () => { task.cancel(); layer?.cancel() }
      const work = [task.promise, layer.render()]
      // Wait for both tasks to settle before reusing a cancelled canvas.
      rendering.current = Promise.allSettled(work)
      await Promise.all(work)
      if (!disposed) { setLoading(false); sheet.current.dataset['rendered'] = `${page}:${zoom}`; if (page === 1 && zoom === 1) performance.mark('watheq-preview-page') }
    })().catch(e => { if (!disposed && e?.name !== 'RenderingCancelledException' && e?.name !== 'AbortException') { setLoading(false); setError('تعذر عرض الصفحة. أعد المحاولة.') } })
    return () => { disposed = true; cancel?.() }
  }, [pdf, page, width, zoom])
  const control = (label: string, action: () => void, icon: React.ReactNode, disabled = false) => <Button size="icon" variant="outline" title={label} aria-label={label} disabled={disabled} onClick={action}>{icon}</Button>
  return <div className="min-w-0">
    <div dir="rtl" className="mb-3 flex flex-wrap items-center justify-center gap-2">
      {control('الصفحة السابقة', () => setPage(p => p - 1), <ChevronRight />, page <= 1 || !pdf)}
      <bdi dir="ltr" className="w-16 text-center text-sm">{pdf ? `${page} / ${pdf.numPages}` : '…'}</bdi>
      {control('الصفحة التالية', () => setPage(p => p + 1), <ChevronLeft />, !pdf || page >= pdf.numPages)}
      {control('تصغير', () => setZoom(z => boundedZoom(z - 0.25)), <ZoomOut />, !pdf || zoom <= 0.5)}
      <bdi dir="ltr" className="w-12 text-center text-xs">{Math.round(zoom * 100)}%</bdi>
      {control('تكبير', () => setZoom(z => boundedZoom(z + 0.25)), <ZoomIn />, !pdf || zoom >= 3)}
      {control('ملاءمة العرض', () => setZoom(1), <Maximize />, !pdf)}
    </div>
    {loading && <p role="status" className="mb-2 flex items-center justify-center gap-2 text-sm"><LoaderCircle className="size-4 motion-safe:animate-spin" />جارٍ عرض الصفحة…</p>}
    {error && <div role="alert" className="mb-3 flex items-center gap-2 text-sm text-destructive">{error}<Button variant="outline" size="sm" onClick={() => setRetry(r => r + 1)}><RotateCw />أعد المحاولة</Button></div>}
    <div ref={box} className="pdf-scroll" aria-busy={loading}>
      <div ref={sheet} className="pdf-page" dir="ltr">
        <canvas ref={canvas} aria-label={`صفحة PDF ${page}`} />
        <div ref={text} className="textLayer" />
      </div>
    </div>
  </div>
}
