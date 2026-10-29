import {describe,it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
// Structural permission regressions are asserted against the applied migration source.
const migrations = import.meta.glob('/supabase/migrations/*.sql',{query:'?raw',import:'default',eager:true})
const sql=Object.values(migrations).join('\n')
describe('Database foundation invariants',()=>{
 it('new users get user regardless of editable metadata',()=>{expect(sql).toMatch(/INSERT INTO public\.user_roles\(user_id,role\) VALUES\(NEW\.id,'user'\)/);expect(sql).not.toMatch(/VALUES\(NEW\.id,'admin'\)/)})
 it('direct role writes are revoked from signed-in users',()=>expect(sql).toMatch(/REVOKE INSERT,UPDATE,DELETE ON public\.user_roles FROM authenticated/))
 it('profile reads are owner or staff only',()=>expect(sql).toMatch(/USING\(id=auth\.uid\(\) OR public\.is_staff\(\)\)/))
 it('membership writes require staff',()=>expect(sql).toMatch(/memberships_staff[^;]+WITH CHECK\(public\.is_staff\(\)\)/))
 it('all six public tables receive explicit grants and RLS',()=>{for(const table of ['profiles','user_roles','categories','groups','group_memberships','brand_settings']){expect(sql).toContain(`ON public.${table} TO authenticated`);expect(sql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`)}})
 it('server role changes verify admin and retain the caller session for database checks',()=>{const source=readFileSync('src/features/foundation/functions.ts','utf8');const roleFunction=source.slice(source.indexOf('export const changeRole'),source.indexOf('export const getPlatformAdmins'));expect(roleFunction.indexOf("_role:'admin'")).toBeGreaterThan(-1);expect(roleFunction.indexOf('if(error||!allowed)')).toBeLessThan(roleFunction.indexOf("context.supabase.rpc('set_account_role'"));expect(roleFunction).not.toContain('supabaseAdmin')})
})
