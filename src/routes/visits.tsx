import {createFileRoute} from '@tanstack/react-router'
import {EmptyPage} from '@/features/foundation/EmptyPage'
import {brandQuery,pageHead} from '@/features/foundation/queries'
export const Route=createFileRoute('/visits')({head:()=>pageHead('طلب تنسيق زيارة لرفاق','طلب تنسيق زيارة لرفاق في منصة وثيق المعرفية لجمعية رفاق.'),loader:({context})=>context.queryClient.ensureQueryData(brandQuery),component:()=> <EmptyPage title="طلب تنسيق زيارة لرفاق"/>})
