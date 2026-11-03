import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import type { Database } from '@/integrations/supabase/types'
import { profileSchema, fonts } from './rules'
import { z } from 'zod'
import { employeeSchema } from './access-rules'
export const getBrand = createServerFn({method:'GET'}).handler(async ()=>{
 const url=import.meta.env['VITE_SUPABASE_URL']||process.env['SUPABASE_URL']; const key=import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY']||process.env['SUPABASE_PUBLISHABLE_KEY']
 if(!url || !key) throw new Error('تعذر الاتصال بإعدادات المنصة')
 const client=createClient<Database>(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>{const req=typeof Request!=='undefined'&&input instanceof Request?input:null;const headers=new Headers(req?.headers);if(init?.headers)new Headers(init.headers).forEach((v,k)=>headers.set(k,v));if(key.startsWith('sb_')&&headers.get('Authorization')===`Bearer ${key}`)headers.delete('Authorization');headers.set('apikey',key);return fetch(input,{...init,headers})}}})
 const {data,error}=await client.from('brand_settings').select('id,title_font,body_font,refaq_logo,wathiq_logo').eq('id',1).single()
 if(error)throw new Error('تعذر تحميل الهوية: '+error.message)
 async function resolve(path:string){if(!path.startsWith('brand:'))return path;const {data,error}=await client.storage.from('brand-assets').createSignedUrl(path.slice(6),3600);if(error)throw new Error('تعذر تحميل الشعار');return data.signedUrl}
 return {...data,refaq_url:await resolve(data.refaq_logo),wathiq_url:await resolve(data.wathiq_logo)}
})
export const getAccount = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async ({context})=>{
  const [profile,roles,memberships,employee]=await Promise.all([context.supabase.from('profiles').select('*').eq('id',context.userId).single(),context.supabase.from('user_roles').select('role').eq('user_id',context.userId),context.supabase.from('group_memberships').select('id,group_id,groups(name)').eq('user_id',context.userId),context.supabase.from('employee_access').select('user_id').eq('user_id',context.userId).maybeSingle()])
  if(profile.error||roles.error||memberships.error||employee.error)throw new Error('تعذر تحميل الحساب')
  return {profile:profile.data,roles:roles.data.map(r=>r.role),memberships:memberships.data,isEmployee:Boolean(employee.data)}
})
export const saveProfile = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((data:unknown)=>profileSchema.parse(data)).handler(async ({data,context})=>{
 const {error}=await context.supabase.from('profiles').update(data).eq('id',context.userId);if(error)throw new Error('تعذر حفظ البيانات');return true
})
export const getAdmin = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async ({context})=>{
 const {data:allowed,error}=await context.supabase.rpc('is_staff');if(error||!allowed)throw new Error('ليس لديك صلاحية الإدارة')
  const [profiles,roles,categories,groups,memberships,employees,categoryMemberships,content,contentCategories,contentGroups]=await Promise.all([context.supabase.from('profiles').select('*').order('created_at'),context.supabase.from('user_roles').select('*'),context.supabase.from('categories').select('*').order('name'),context.supabase.from('groups').select('*').order('name'),context.supabase.from('group_memberships').select('*'),context.supabase.from('employee_access').select('user_id'),context.supabase.from('category_memberships').select('*'),context.supabase.from('content_items').select('id,title,audience'),context.supabase.from('content_categories').select('content_id,category_id'),context.supabase.from('content_groups').select('content_id,group_id')])
  if(profiles.error||roles.error||categories.error||groups.error||memberships.error||employees.error||categoryMemberships.error||content.error||contentCategories.error||contentGroups.error)throw new Error('تعذر تحميل الإدارة')
  return {profiles:profiles.data,roles:roles.data,categories:categories.data,groups:groups.data,memberships:memberships.data,employees:employees.data,categoryMemberships:categoryMemberships.data,content:content.data,contentCategories:contentCategories.data,contentGroups:contentGroups.data}
})
export const changeRole = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(z.object({userId:z.string().uuid(),role:z.enum(['admin','supervisor','user'])})).handler(async ({data,context})=>{
 const {data:allowed,error}=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});if(error||!allowed)throw new Error('منح الأدوار متاح لمدير المنصة فقط')
 if(data.userId===context.userId)throw new Error('لا يمكنك تغيير دورك من هذه الصفحة')
  const result=await context.supabase.rpc('set_account_role',{target_user:data.userId,new_role:data.role})
  if(result.error)throw new Error(result.error.message);return true
})
export const getPlatformAdmins = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async ({context})=>{
 const {data:allowed,error}=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'})
 if(error||!allowed)throw new Error('عرض المديرين متاح لمدير المنصة فقط')
 const [directory,audit]=await Promise.all([context.supabase.rpc('get_admin_directory'),context.supabase.from('role_audit_log').select('*').order('created_at',{ascending:false}).limit(100)])
 if(directory.error||audit.error)throw new Error('تعذر تحميل المديرين وسجل التدقيق')
 return {directory:directory.data,audit:audit.data}
})
export const saveBrand = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(z.object({title_font:z.enum(fonts),body_font:z.enum(fonts),refaq_logo:z.string(),wathiq_logo:z.string()})).handler(async ({data,context})=>{
 const {data:allowed}=await context.supabase.rpc('is_staff');if(!allowed)throw new Error('ليس لديك صلاحية تعديل الهوية')
 const {error}=await context.supabase.from('brand_settings').update(data).eq('id',1);if(error)throw new Error('تعذر حفظ الهوية');return true
})
export const changeEmployee = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(employeeSchema).handler(async ({data,context})=>{
 const {data:allowed,error}=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'})
 if(error||!allowed)throw new Error('منح صفة الموظف متاح لمدير المنصة فقط')
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server')
 const result=await supabaseAdmin.rpc('set_employee_access',{target_user:data.userId,enabled:data.enabled})
 if(result.error)throw new Error('تعذر تغيير صفة الموظف')
 return true
})
export const manageOrganization = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(z.discriminatedUnion('action',[
 z.object({action:z.literal('category-add'),name:z.string().trim().min(2)}),z.object({action:z.literal('group-add'),name:z.string().trim().min(2)}),
 z.object({action:z.literal('category-delete'),id:z.string().uuid()}),z.object({action:z.literal('group-delete'),id:z.string().uuid()}),
 z.object({action:z.literal('member-add'),groupId:z.string().uuid(),userId:z.string().uuid()}),z.object({action:z.literal('member-delete'),id:z.string().uuid()}),
 z.object({action:z.literal('category-member-add'),categoryId:z.string().uuid(),userId:z.string().uuid()}),z.object({action:z.literal('category-member-delete'),id:z.string().uuid()}),
])).handler(async ({data,context})=>{
 const {data:allowed}=await context.supabase.rpc('is_staff');if(!allowed)throw new Error('ليس لديك صلاحية إدارة العضويات')
 let error
 switch(data.action){case 'category-add':({error}=await context.supabase.from('categories').insert({name:data.name}));break;case 'group-add':({error}=await context.supabase.from('groups').insert({name:data.name}));break;case 'category-delete':({error}=await context.supabase.from('categories').delete().eq('id',data.id));break;case 'group-delete':({error}=await context.supabase.from('groups').delete().eq('id',data.id));break;case 'member-add':({error}=await context.supabase.from('group_memberships').insert({group_id:data.groupId,user_id:data.userId}));break;case 'member-delete':({error}=await context.supabase.from('group_memberships').delete().eq('id',data.id));break;case 'category-member-add':({error}=await context.supabase.from('category_memberships').insert({category_id:data.categoryId,user_id:data.userId}));break;case 'category-member-delete':({error}=await context.supabase.from('category_memberships').delete().eq('id',data.id));break}
 if(error)throw new Error(error.code==='23505'?'العضوية موجودة بالفعل':'تعذر حفظ التغيير');return true
})
