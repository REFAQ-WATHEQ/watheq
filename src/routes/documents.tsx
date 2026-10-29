import {createFileRoute} from '@tanstack/react-router'
import {zodValidator} from '@tanstack/zod-adapter'
import {DocumentLibrary} from '@/features/library/DocumentLibrary'
import {librarySearchSchema} from '@/features/library/library-search'
import {brandQuery,pageHead} from '@/features/foundation/queries'
export const Route=createFileRoute('/documents')({validateSearch:zodValidator(librarySearchSchema),head:()=>pageHead('مكتبة الوثائق','مكتبة الوثائق في منصة وثيق المعرفية لجمعية رفاق.'),loader:({context})=>context.queryClient.ensureQueryData(brandQuery),component:DocumentLibrary})
