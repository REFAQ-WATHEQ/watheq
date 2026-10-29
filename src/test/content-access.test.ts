import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { audienceSchema, employeeSchema } from '@/features/foundation/access-rules'
import { isStaff, canGrantRoles, signupSchema, profileSchema } from '@/features/foundation/rules'

const migrations = import.meta.glob('/supabase/migrations/*.sql', { query: '?raw', import: 'default', eager: true })
const sql = Object.values(migrations).join('\n')
const id = '11111111-1111-4111-8111-111111111111'
describe('Employee and audience access', () => {
  it('employee does not grant administration or role management', () => {
    expect(isStaff(['user', 'employee'])).toBe(false)
    expect(canGrantRoles(['user', 'employee'])).toBe(false)
    expect(isStaff(['supervisor', 'employee'])).toBe(true)
    expect(canGrantRoles(['supervisor', 'employee'])).toBe(false)
    expect(canGrantRoles(['admin', 'employee'])).toBe(true)
  })
  it('employee designation is separate and has no browser write grants', () => {
    expect(sql).toContain('CREATE TABLE public.employee_access (user_id uuid PRIMARY KEY REFERENCES public.profiles(id)')
    expect(sql).toContain('GRANT SELECT ON public.employee_access TO authenticated')
    expect(sql).not.toMatch(/GRANT (?:ALL|[^;]*INSERT[^;]*) ON public\.employee_access TO authenticated/)
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.set_employee_access(uuid,boolean) FROM PUBLIC,anon,authenticated')
  })
  it('only admin authorizes employee mutation before privileged import', () => {
    const source = readFileSync('src/features/foundation/functions.ts', 'utf8')
    const fn = source.slice(source.indexOf('export const changeEmployee'), source.indexOf('export const manageOrganization'))
    expect(fn).toContain('.middleware([requireSupabaseAuth])')
    expect(fn).toContain("_role:'admin'")
    expect(fn.indexOf('if(error||!allowed)')).toBeGreaterThan(-1)
    expect(fn.indexOf('if(error||!allowed)')).toBeLessThan(fn.indexOf("await import('@/integrations/supabase/client.server')"))
  })
  it('signup and profile edits do not accept employee designation', () => {
    const profile = { full_name: 'اختبار موظف', organization: 'رفاق', job_title: 'أخصائي', mobile: '0501234567', isEmployee: true }
    expect(profileSchema.parse(profile)).not.toHaveProperty('isEmployee')
    expect(signupSchema.parse({ ...profile, email: 'test@example.org', password: 'test12345' })).not.toHaveProperty('isEmployee')
    expect(employeeSchema.safeParse({ userId: id, enabled: true, role: 'admin' }).success).toBe(false)
  })
  it('supports the four specified audiences', () => {
    for (const audience of ['everyone', 'registered', 'employees', 'targeted']) {
      expect(audienceSchema.safeParse({ contentId: id, audience, categoryIds: [id] }).success).toBe(true)
    }
    expect(audienceSchema.safeParse({ contentId: id, audience: 'unknown' }).success).toBe(false)
  })
  it('targeted audience requires a category or group', () => {
    expect(audienceSchema.safeParse({ contentId: id, audience: 'targeted' }).success).toBe(false)
    expect(audienceSchema.safeParse({ contentId: id, audience: 'targeted', groupIds: [id] }).success).toBe(true)
    expect(sql).toContain("new_audience='targeted' AND coalesce(cardinality(category_ids),0)+coalesce(cardinality(group_ids),0)=0")
  })
  it('database filters reads by publication, sign-in, employee and memberships', () => {
    expect(sql).toContain('(c.published AND CASE c.audience')
    expect(sql).toContain("WHEN 'everyone' THEN true")
    expect(sql).toContain("WHEN 'registered' THEN auth.uid() IS NOT NULL")
    expect(sql).toContain("WHEN 'employees' THEN auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.employee_access")
    expect(sql).toContain('cm.user_id=auth.uid()')
    expect(sql).toContain('gm.user_id=auth.uid()')
    expect(sql).toContain('USING(private.can_read_content(id))')
    expect(sql).toContain('USING(private.can_read_content(content_id))')
  })
  it('every new public table has grants and RLS', () => {
    for (const table of ['employee_access', 'category_memberships', 'content_items', 'content_categories', 'content_groups', 'content_files']) {
      expect(sql).toContain(`ON public.${table} TO authenticated`)
      expect(sql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`)
    }
  })
})
