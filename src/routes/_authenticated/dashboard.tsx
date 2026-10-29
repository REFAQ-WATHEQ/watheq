import {createFileRoute,redirect} from '@tanstack/react-router'
import {EmptyPage} from '@/features/foundation/EmptyPage'
import {accountQuery,brandQuery,pageHead} from '@/features/foundation/queries'
import {isStaff} from '@/features/foundation/rules'
export const Route=createFileRoute('/_authenticated/dashboard')({head:()=>pageHead('لوحة البيانات','المؤشرات والبيانات الإدارية لمنصة وثيق، متاحة للإدارة المخولة فقط.'),beforeLoad:async({context})=>{const account=await context.queryClient.ensureQueryData(accountQuery);if(!isStaff(account.roles))throw redirect({to:'/account'})},loader:({context})=>context.queryClient.ensureQueryData(brandQuery),component:()=> <EmptyPage title="لوحة البيانات"/>})
