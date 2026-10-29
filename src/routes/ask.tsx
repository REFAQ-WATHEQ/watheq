import {createFileRoute} from '@tanstack/react-router'
import {EmptyPage} from '@/features/foundation/EmptyPage'
import {brandQuery,pageHead} from '@/features/foundation/queries'
export const Route=createFileRoute('/ask')({head:()=>pageHead('اسأل وثيق','اسأل وثيق في منصة وثيق المعرفية لجمعية رفاق.'),loader:({context})=>context.queryClient.ensureQueryData(brandQuery),component:()=> <EmptyPage title="اسأل وثيق"/>})
