import { supabase } from '@/integrations/supabase/client'

export async function requestDocumentFile(id: string, action: 'view' | 'download' | 'preview', requestId: string, format?: string, signal?: AbortSignal) {
  const { data } = await supabase.auth.getSession()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (data.session) headers['Authorization'] = `Bearer ${data.session.access_token}`
  const res = await fetch(`/api/public/documents/${encodeURIComponent(id)}`, {
    method: 'POST', credentials: 'same-origin', headers, signal: signal ?? null,
    body: JSON.stringify({ action, requestId, ...(format ? { format } : {}) }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob); const a = document.createElement('a')
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

export async function deliverBlob(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: blob.type })
  if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: filename }); return }
    catch (e) { if ((e as DOMException).name === 'AbortError') return }
  }
  downloadBlob(blob, filename)
}

export function responseFilename(response: Response, title: string) {
  const match = response.headers.get('Content-Disposition')?.match(/filename\*=UTF-8''([^;]+)/)
  if (match?.[1]) { try { return decodeURIComponent(match[1]) } catch { /* safe fallback */ } }
  return title
}
