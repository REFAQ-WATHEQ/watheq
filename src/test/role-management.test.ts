import {describe,it,expect} from 'vitest'
import {canRevokeAdmin,canGrantRoles,isStaff,signupSchema,profileSchema} from '@/features/foundation/rules'
describe('Multiple platform administrators',()=>{
 const active={user_id:'a',eligible:true};const second={user_id:'b',eligible:true}
 it('allows revoking another administrator when an active replacement exists',()=>expect(canRevokeAdmin([active,second],'b','a')).toBe(true))
 it('protects the last active administrator',()=>expect(canRevokeAdmin([active],'a','b')).toBe(false))
 it('an inactive administrator is not a replacement',()=>expect(canRevokeAdmin([active,{...second,eligible:false}],'a','c')).toBe(false))
 it('preserves the prohibition on self-role changes',()=>expect(canRevokeAdmin([active,second],'a','a')).toBe(false))
 it('can remove an inactive administrator while retaining an active one',()=>expect(canRevokeAdmin([active,{...second,eligible:false}],'b','a')).toBe(true))
 it('only administrators can assign and revoke administrators',()=>{expect(canGrantRoles(['admin'])).toBe(true);expect(canGrantRoles(['supervisor'])).toBe(false);expect(canGrantRoles(['user'])).toBe(false)})
 it('does not confer administrative rights through employee designation',()=>expect(isStaff(['employee','user'])).toBe(false))
 it('signup and profile fields cannot assign roles',()=>{expect('role' in signupSchema.shape).toBe(false);expect('role' in profileSchema.shape).toBe(false)})
})
