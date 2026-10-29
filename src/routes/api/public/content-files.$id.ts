import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
export const Route = createFileRoute('/api/public/content-files/$id')({ server: { handlers: {
  POST: async ({ request, params }) => {
    const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }
    if (!z.string().uuid().safeParse(params.id).success) return new Response('غير متاح', { status: 404, headers })
    try {
      const { contentClient } = await import('@/features/foundation/content-client.server')
      const client = await contentClient(process.env['SUPABASE_URL'], process.env['SUPABASE_PUBLISHABLE_KEY'], request.headers.get('authorization'))
      const { data: file, error } = await client.from('content_files').select('content_id,object_path').eq('id', params.id).maybeSingle()
      if (error || !file) return new Response('غير متاح', { status: 404, headers })
      const { data: item } = await client.from('content_items').select('id').eq('id', file.content_id).maybeSingle()
      if (!item) return new Response('غير متاح', { status: 404, headers })
      // Download with user RLS on each request; never issue transferable signed URLs.
      const { data, error: downloadError } = await client.storage.from('content-files').download(file.object_path)
      if (downloadError || !data) return new Response('غير متاح', { status: 404, headers })
      return new Response(data, { headers: { ...headers, 'Content-Type': 'application/octet-stream', 'Content-Disposition': 'attachment' } })
    } catch { return new Response('غير متاح', { status: 403, headers }) }
  },
} } })
