import { z } from 'zod'
export const audienceLabels = { everyone: 'الجميع', registered: 'المستخدمون المسجلون', employees: 'الموظفون', targeted: 'فئات ومجموعات محددة' } as const
export const audienceSchema = z.object({
  contentId: z.string().uuid(),
  audience: z.enum(['everyone', 'registered', 'employees', 'targeted']),
  categoryIds: z.array(z.string().uuid()).default([]),
  groupIds: z.array(z.string().uuid()).default([]),
}).refine(data => data.audience !== 'targeted' || data.categoryIds.length + data.groupIds.length > 0, 'اختر فئة أو مجموعة')
export const employeeSchema = z.object({ userId: z.string().uuid(), enabled: z.boolean() }).strict()
