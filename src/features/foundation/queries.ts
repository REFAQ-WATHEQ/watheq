import { queryOptions } from '@tanstack/react-query'
import {getBrand,getAccount,getAdmin,getPlatformAdmins} from './functions'
export const brandQuery = queryOptions({queryKey:['brand'],queryFn:()=>getBrand(),staleTime:300000})
export const accountQuery = queryOptions({queryKey:['account'],queryFn:()=>getAccount()})
export const adminQuery = queryOptions({queryKey:['admin'],queryFn:()=>getAdmin()})
export const platformAdminsQuery = queryOptions({queryKey:['platform-admins'],queryFn:()=>getPlatformAdmins()})
export function pageHead(title:string,description:string){return {meta:[{title:`${title} | وثيق — جمعية رفاق`},{name:'description',content:description},{property:'og:title',content:`${title} | وثيق`},{property:'og:description',content:description},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}}
