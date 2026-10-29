import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/public/documents/$id')({ server: { handlers: {
  POST: async ({ request, params }) => {
    const { handleDocumentDelivery } = await import('@/features/library/delivery.server')
    return handleDocumentDelivery(request, params.id)
  },
} } })
