import {createFileRoute} from '@tanstack/react-router'
import {ContentSpace} from '@/features/foundation/ContentSpace'
import {brandQuery,pageHead} from '@/features/foundation/queries'
export const Route=createFileRoute('/blog')({head:()=>pageHead('المدونة المعرفية','المدونة المعرفية في منصة وثيق المعرفية لجمعية رفاق.'),loader:({context})=>context.queryClient.ensureQueryData(brandQuery),component:()=> <ContentSpace kind="blog" title="المدونة المعرفية"/>})
