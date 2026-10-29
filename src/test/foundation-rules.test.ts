import {describe,it,expect} from 'vitest'
import {profileSchema,signupSchema,isStaff,canGrantRoles,fonts,authEntryFromHash} from '@/features/foundation/rules'
const profile={full_name:'مستخدم اختبار',organization:'جمعية رفاق',job_title:'أخصائي',mobile:'0501234567'}
describe('Foundation requirements',()=>{
 for(const field of ['full_name','organization','job_title','mobile'] as const)it(`${field} is mandatory`,()=>expect(profileSchema.safeParse({...profile,[field]:''}).success).toBe(false))
 it('email is mandatory',()=>expect(signupSchema.safeParse({...profile,password:'pass12345',email:''}).success).toBe(false))
 it('complete profile accepted',()=>expect(profileSchema.safeParse(profile).success).toBe(true))
 it('ordinary users cannot manage components',()=>expect(isStaff(['user'])).toBe(false))
 it('supervisors can manage components',()=>expect(isStaff(['supervisor'])).toBe(true))
 it('admins can manage components',()=>expect(isStaff(['admin'])).toBe(true))
 it('supervisors cannot grant roles',()=>expect(canGrantRoles(['supervisor'])).toBe(false))
 it('users cannot grant roles',()=>expect(canGrantRoles(['user'])).toBe(false))
 it('admins can grant roles',()=>expect(canGrantRoles(['admin'])).toBe(true))
 it('all eight requested Arabic font options exist',()=>expect(fonts).toEqual(['Cairo','Tajawal','Almarai','IBM Plex Sans Arabic','Noto Sans Arabic','Noto Kufi Arabic','Readex Pro','Amiri']))
 it('recovery hash opens the reset form',()=>expect(authEntryFromHash('#access_token=x&type=recovery')).toEqual({kind:'reset'}))
 it('expired recovery link shows a clear message',()=>{const entry=authEntryFromHash('#error=access_denied&error_code=otp_expired');expect(entry).toMatchObject({kind:'error'});expect(entry?.kind==='error'&&entry.message).toContain('انتهت صلاحية')})
 it('invalid recovery link shows a clear message',()=>{const entry=authEntryFromHash('#error=access_denied');expect(entry).toMatchObject({kind:'error'})})
 it('empty hash does not trigger recovery',()=>expect(authEntryFromHash('')).toBeNull())
})
