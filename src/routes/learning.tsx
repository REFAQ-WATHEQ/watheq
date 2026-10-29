import {createFileRoute} from '@tanstack/react-router'
import {ContentSpace} from '@/features/foundation/ContentSpace'
import {brandQuery,pageHead} from '@/features/foundation/queries'
export const Route=createFileRoute('/learning')({head:()=>pageHead('التعلم الإلكتروني','التعلم الإلكتروني في منصة وثيق المعرفية لجمعية رفاق.'),loader:({context})=>context.queryClient.ensureQueryData(brandQuery),component:()=> <ContentSpace kind="learning" title="التعلم الإلكتروني"/>})
