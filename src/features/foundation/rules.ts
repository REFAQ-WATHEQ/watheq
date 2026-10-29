import { z } from 'zod'
export const fonts = ['Cairo','Tajawal','Almarai','IBM Plex Sans Arabic','Noto Sans Arabic','Noto Kufi Arabic','Readex Pro','Amiri'] as const
export const profileSchema = z.object({ full_name: z.string().trim().min(2,'أدخل الاسم الكامل'), organization: z.string().trim().min(2,'أدخل الجهة'), job_title: z.string().trim().min(2,'أدخل المسمى الوظيفي'), mobile: z.string().regex(/^\+?[0-9 ()-]{7,20}$/,'أدخل رقم جوال صحيحاً') })
export const signupSchema = profileSchema.extend({ email:z.string().email('أدخل بريداً صحيحاً'), password:z.string().min(8,'كلمة المرور لا تقل عن ٨ أحرف') })
export const isStaff = (roles: string[]) => roles.includes('admin') || roles.includes('supervisor')
export type AuthEntry = {kind:'reset'} | {kind:'error',message:string} | null
export function authEntryFromHash(hash:string):AuthEntry{
 if(!hash) return null
 const params=new URLSearchParams(hash.replace(/^#/,''))
 if(params.get('error')) return {kind:'error',message:params.get('error_code')==='otp_expired'?'انتهت صلاحية رابط الاستعادة؛ اطلب رابطاً جديداً.':'رابط الاستعادة غير صالح؛ اطلب رابطاً جديداً.'}
 if(params.get('type')==='recovery') return {kind:'reset'}
 return null
}
export const canGrantRoles = (roles: string[]) => roles.includes('admin')
export const canRevokeAdmin = (admins: {user_id:string,eligible:boolean}[], targetUserId:string, currentUserId:string) => targetUserId!==currentUserId && admins.some(p=>p.user_id!==targetUserId&&p.eligible)
export const roleLabels = { admin:'مدير المنصة', supervisor:'مشرف', user:'مستخدم' }
