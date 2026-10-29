import { createFileRoute } from '@tanstack/react-router'
import { ContentDetail } from '@/features/foundation/ContentSpace'
import { brandQuery, pageHead } from '@/features/foundation/queries'
export const Route = createFileRoute('/content/$id')({ head: () => pageHead('المحتوى المعرفي', 'المحتوى المتاح لك في منصة وثيق التابعة لجمعية رفاق.'), loader: ({ context }) => context.queryClient.ensureQueryData(brandQuery), component: Page })
function Page() { return <ContentDetail id={Route.useParams().id}/> }
