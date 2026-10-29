import {createFileRoute} from '@tanstack/react-router'
import {ContentSpace} from '@/features/foundation/ContentSpace'
import {brandQuery,pageHead} from '@/features/foundation/queries'
export const Route=createFileRoute('/lessons')({head:()=>pageHead('الدروس المستفادة','الدروس المستفادة في منصة وثيق المعرفية لجمعية رفاق.'),loader:({context})=>context.queryClient.ensureQueryData(brandQuery),component:()=> <ContentSpace kind="lessons" title="الدروس المستفادة"/>})
