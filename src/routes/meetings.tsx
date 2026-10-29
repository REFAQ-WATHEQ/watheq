import {createFileRoute} from '@tanstack/react-router'
import {ContentSpace} from '@/features/foundation/ContentSpace'
import {brandQuery,pageHead} from '@/features/foundation/queries'
export const Route=createFileRoute('/meetings')({head:()=>pageHead('اللقاءات والفيديوهات المعرفية','اللقاءات والفيديوهات المعرفية في منصة وثيق المعرفية لجمعية رفاق.'),loader:({context})=>context.queryClient.ensureQueryData(brandQuery),component:()=> <ContentSpace kind="meetings" title="اللقاءات والفيديوهات المعرفية"/>})
