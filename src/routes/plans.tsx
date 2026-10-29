import {createFileRoute} from '@tanstack/react-router'
import {ContentSpace} from '@/features/foundation/ContentSpace'
import {brandQuery,pageHead} from '@/features/foundation/queries'
export const Route=createFileRoute('/plans')({head:()=>pageHead('خطط التعلم','خطط التعلم في منصة وثيق المعرفية لجمعية رفاق.'),loader:({context})=>context.queryClient.ensureQueryData(brandQuery),component:()=> <ContentSpace kind="plans" title="خطط التعلم"/>})
