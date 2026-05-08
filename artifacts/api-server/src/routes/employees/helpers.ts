import { type Request, type Response } from 'express';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { db, employeesTable } from '@workspace/db';
import { z } from 'zod';

export function fmtTs(v: Date | null | undefined): string | null {
  if (!v) return null;
  return v instanceof Date ? v.toISOString() : String(v);
}

export function formatEmployee(e: Record<string, unknown>) {
  return {
    ...e,
    salary: Number(e.salary ?? 0),
    created_at: fmtTs(e.created_at as Date),
    updated_at: fmtTs(e.updated_at as Date),
    deleted_at: fmtTs(e.deleted_at as Date | null | undefined),
  };
}

export async function generateEmployeeCode(companyId: number): Promise<string> {
  const result = await db
    .select({ code: employeesTable.employee_code })
    .from(employeesTable)
    .where(and(eq(employeesTable.company_id, companyId), isNull(employeesTable.deleted_at)))
    .orderBy(desc(employeesTable.id))
    .limit(1);

  let nextNum = 1;
  if (result.length > 0) {
    const lastCode = result[0].code ?? '';
    const numeric = parseInt(lastCode.replace(/\D/g, ''), 10);
    if (!isNaN(numeric)) nextNum = numeric + 1;
  }
  return `EMP${String(nextNum).padStart(4, '0')}`;
}

export function requireHrAccess(req: Request, res: Response): boolean {
  const role = (req as Request & { user?: { role?: string } }).user?.role ?? '';
  if (!['admin', 'manager', 'super_admin'].includes(role)) {
    res.status(403).json({ error: 'غير مصرح بالوصول لموارد الموارد البشرية' });
    return false;
  }
  return true;
}

export const employeeCreateSchema = z.object({
  first_name_ar: z.string().min(1, 'الاسم الأول (عربي) مطلوب'),
  last_name_ar: z.string().min(1, 'الاسم الأخير (عربي) مطلوب'),
  first_name_en: z.string().optional().default(''),
  last_name_en: z.string().optional().default(''),
  email: z.string().optional().default(''),
  phone: z
    .string()
    .optional()
    .refine((v) => !v || /^\d{11}$/.test(v), { message: 'رقم الهاتف يجب أن يكون 11 رقم بالضبط' }),
  personal_phone: z.string().optional(),
  national_id: z
    .string()
    .optional()
    .refine((v) => !v || /^\d{14}$/.test(v), { message: 'الرقم القومي يجب أن يكون 14 رقم بالضبط' }),
  national_id_image: z.string().optional().nullable(),
  job_title_id: z.number().optional().nullable(),
  department_id: z.number().optional().nullable(),
  branch_id: z.number().optional().nullable(),
  hire_date: z.string().min(1, 'تاريخ التعيين مطلوب'),
  salary: z.number().min(0, 'الراتب يجب أن يكون رقماً موجباً'),
  currency: z.string().optional().default('EGP'),
  salary_type: z.enum(['fixed', 'commission', 'fixed_plus_commission']).optional().default('fixed'),
  commission_rate: z.number().min(0).max(100).optional().nullable(),
  commission_basis: z.enum(['gross', 'net']).optional().nullable(),
  commission_scope_dept_id: z.number().optional().nullable(),
  bank_account: z.string().optional(),
  address_ar: z.string().optional(),
  address_en: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional().default('مصر'),
  notes: z.string().optional(),
  employee_code: z.string().optional(),
});
