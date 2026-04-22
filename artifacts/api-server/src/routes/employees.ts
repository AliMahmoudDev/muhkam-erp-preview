/**
 * /api/employees, /api/departments, /api/job-titles
 * Comprehensive HR employee management with multi-tenant support and audit logging.
 */
import { Router, type IRouter, type Request, type Response } from 'express';
import { eq, and, isNull, desc, ilike, or, sql } from 'drizzle-orm';
import {
  db,
  employeesTable,
  employeeDocumentsTable,
  employeeContactsTable,
  employeeStatusHistoryTable,
  departmentsTable,
  jobTitlesTable,
  branchesTable,
} from '@workspace/db';
import { wrap } from '../lib/async-handler';
import { hasPermission } from '../lib/permissions';
import { selfEmployeeId } from '../lib/employee-self';
import { writeAuditLog } from '../lib/audit-log';
import { z } from 'zod';

const router: IRouter = Router();

/* ═══════════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════════════ */

function fmtTs(v: Date | null | undefined): string | null {
  if (!v) return null;
  return v instanceof Date ? v.toISOString() : String(v);
}

function formatEmployee(e: Record<string, unknown>) {
  return {
    ...e,
    salary: Number(e.salary ?? 0),
    created_at: fmtTs(e.created_at as Date),
    updated_at: fmtTs(e.updated_at as Date),
    deleted_at: fmtTs(e.deleted_at as Date | null | undefined),
  };
}

async function generateEmployeeCode(companyId: number): Promise<string> {
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

function requireHrAccess(req: Request, res: Response): boolean {
  const role = (req as Request & { user?: { role?: string } }).user?.role ?? '';
  if (!['admin', 'manager', 'super_admin'].includes(role)) {
    res.status(403).json({ error: 'غير مصرح بالوصول لموارد الموارد البشرية' });
    return false;
  }
  return true;
}

/* ═══════════════════════════════════════════════════════════════════
   DEPARTMENTS
══════════════════════════════════════════════════════════════════════ */

router.get(
  '/departments',
  wrap(async (req, res) => {
    const companyId = req.user!.company_id!;
    const rows = await db
      .select()
      .from(departmentsTable)
      .where(eq(departmentsTable.company_id, companyId))
      .orderBy(departmentsTable.name_ar);
    res.json(rows.map((d) => ({ ...d, created_at: fmtTs(d.created_at) })));
  })
);

router.post(
  '/departments',
  wrap(async (req, res) => {
    if (!requireHrAccess(req, res)) return;
    const companyId = req.user!.company_id!;
    const { name_en, name_ar, description_en, description_ar } = req.body as Record<string, string>;
    if (!name_ar?.trim()) {
      res.status(400).json({ error: 'اسم القسم (عربي) مطلوب' });
      return;
    }
    const [dep] = await db
      .insert(departmentsTable)
      .values({
        company_id: companyId,
        name_en: name_en?.trim() ?? name_ar.trim(),
        name_ar: name_ar.trim(),
        description_en: description_en ?? null,
        description_ar: description_ar ?? null,
      })
      .returning();
    res.status(201).json({ ...dep, created_at: fmtTs(dep.created_at) });
  })
);

router.put(
  '/departments/:id',
  wrap(async (req, res) => {
    if (!requireHrAccess(req, res)) return;
    const companyId = req.user!.company_id!;
    const id = parseInt(String(req.params['id']), 10);
    const { name_en, name_ar, description_en, description_ar } = req.body as Record<string, string>;
    if (!name_ar?.trim()) {
      res.status(400).json({ error: 'اسم القسم (عربي) مطلوب' });
      return;
    }
    const [dep] = await db
      .update(departmentsTable)
      .set({
        name_en: name_en?.trim() ?? name_ar.trim(),
        name_ar: name_ar.trim(),
        description_en: description_en ?? null,
        description_ar: description_ar ?? null,
      })
      .where(and(eq(departmentsTable.id, id), eq(departmentsTable.company_id, companyId)))
      .returning();
    if (!dep) {
      res.status(404).json({ error: 'القسم غير موجود' });
      return;
    }
    res.json({ ...dep, created_at: fmtTs(dep.created_at) });
  })
);

router.delete(
  '/departments/:id',
  wrap(async (req, res) => {
    if (!requireHrAccess(req, res)) return;
    const companyId = req.user!.company_id!;
    const id = parseInt(String(req.params['id']), 10);
    const active = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(employeesTable)
      .where(
        and(
          eq(employeesTable.department_id, id),
          eq(employeesTable.company_id, companyId),
          isNull(employeesTable.deleted_at),
          eq(employeesTable.employment_status, 'active')
        )
      );
    if ((active[0]?.count ?? 0) > 0) {
      res.status(422).json({ error: 'لا يمكن حذف قسم يحتوي على موظفين نشطين' });
      return;
    }
    await db
      .delete(departmentsTable)
      .where(and(eq(departmentsTable.id, id), eq(departmentsTable.company_id, companyId)));
    res.json({ ok: true });
  })
);

/* ═══════════════════════════════════════════════════════════════════
   JOB TITLES
══════════════════════════════════════════════════════════════════════ */

router.get(
  '/job-titles',
  wrap(async (req, res) => {
    const companyId = req.user!.company_id!;
    const rows = await db
      .select()
      .from(jobTitlesTable)
      .where(eq(jobTitlesTable.company_id, companyId))
      .orderBy(jobTitlesTable.name_ar);
    res.json(rows.map((j) => ({ ...j, created_at: fmtTs(j.created_at) })));
  })
);

router.post(
  '/job-titles',
  wrap(async (req, res) => {
    if (!requireHrAccess(req, res)) return;
    const companyId = req.user!.company_id!;
    const { name_en, name_ar } = req.body as Record<string, string>;
    if (!name_ar?.trim()) {
      res.status(400).json({ error: 'المسمى الوظيفي (عربي) مطلوب' });
      return;
    }
    const [jt] = await db
      .insert(jobTitlesTable)
      .values({
        company_id: companyId,
        name_en: name_en?.trim() ?? name_ar.trim(),
        name_ar: name_ar.trim(),
      })
      .returning();
    res.status(201).json({ ...jt, created_at: fmtTs(jt.created_at) });
  })
);

router.put(
  '/job-titles/:id',
  wrap(async (req, res) => {
    if (!requireHrAccess(req, res)) return;
    const companyId = req.user!.company_id!;
    const id = parseInt(String(req.params['id']), 10);
    const { name_en, name_ar } = req.body as Record<string, string>;
    if (!name_ar?.trim()) {
      res.status(400).json({ error: 'المسمى الوظيفي (عربي) مطلوب' });
      return;
    }
    const [jt] = await db
      .update(jobTitlesTable)
      .set({ name_en: name_en?.trim() ?? name_ar.trim(), name_ar: name_ar.trim() })
      .where(and(eq(jobTitlesTable.id, id), eq(jobTitlesTable.company_id, companyId)))
      .returning();
    if (!jt) {
      res.status(404).json({ error: 'المسمى الوظيفي غير موجود' });
      return;
    }
    res.json({ ...jt, created_at: fmtTs(jt.created_at) });
  })
);

router.delete(
  '/job-titles/:id',
  wrap(async (req, res) => {
    if (!requireHrAccess(req, res)) return;
    const companyId = req.user!.company_id!;
    const id = parseInt(String(req.params['id']), 10);
    const active = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(employeesTable)
      .where(
        and(
          eq(employeesTable.job_title_id, id),
          eq(employeesTable.company_id, companyId),
          isNull(employeesTable.deleted_at)
        )
      );
    if ((active[0]?.count ?? 0) > 0) {
      res.status(422).json({ error: 'لا يمكن حذف مسمى وظيفي مرتبط بموظفين' });
      return;
    }
    await db
      .delete(jobTitlesTable)
      .where(and(eq(jobTitlesTable.id, id), eq(jobTitlesTable.company_id, companyId)));
    res.json({ ok: true });
  })
);

/* ═══════════════════════════════════════════════════════════════════
   EMPLOYEES — LIST & CREATE
══════════════════════════════════════════════════════════════════════ */

const employeeCreateSchema = z.object({
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

router.get(
  '/employees',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_view_employees')) {
      res.status(403).json({ error: 'غير مصرح بعرض الموظفين' });
      return;
    }
    const companyId = req.user!.company_id!;
    const search = String(req.query['search'] ?? '').trim();
    const deptId = req.query['department_id']
      ? parseInt(String(req.query['department_id']), 10)
      : null;
    const status = String(req.query['status'] ?? '');
    const page = Math.max(1, parseInt(String(req.query['page'] ?? '1'), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query['limit'] ?? '50'), 10)));
    const offset = (page - 1) * limit;

    const conditions = [
      eq(employeesTable.company_id, companyId),
      isNull(employeesTable.deleted_at),
    ];
    // Self-service: restrict list to the caller's own employee record
    const selfId = selfEmployeeId(req);
    if (selfId !== null) conditions.push(eq(employeesTable.id, selfId));
    if (deptId) conditions.push(eq(employeesTable.department_id, deptId));
    if (status) conditions.push(eq(employeesTable.employment_status, status));
    if (search) {
      conditions.push(
        or(
          ilike(employeesTable.first_name_ar, `%${search}%`),
          ilike(employeesTable.last_name_ar, `%${search}%`),
          ilike(employeesTable.first_name_en, `%${search}%`),
          ilike(employeesTable.last_name_en, `%${search}%`),
          ilike(employeesTable.employee_code, `%${search}%`),
          ilike(employeesTable.national_id, `%${search}%`)
        )!
      );
    }

    const rows = await db
      .select({
        id: employeesTable.id,
        company_id: employeesTable.company_id,
        employee_code: employeesTable.employee_code,
        first_name_ar: employeesTable.first_name_ar,
        last_name_ar: employeesTable.last_name_ar,
        first_name_en: employeesTable.first_name_en,
        last_name_en: employeesTable.last_name_en,
        email: employeesTable.email,
        phone: employeesTable.phone,
        national_id: employeesTable.national_id,
        job_title_id: employeesTable.job_title_id,
        department_id: employeesTable.department_id,
        branch_id: employeesTable.branch_id,
        hire_date: employeesTable.hire_date,
        employment_status: employeesTable.employment_status,
        salary: employeesTable.salary,
        currency: employeesTable.currency,
        salary_type: employeesTable.salary_type,
        commission_rate: employeesTable.commission_rate,
        commission_basis: employeesTable.commission_basis,
        commission_scope_dept_id: employeesTable.commission_scope_dept_id,
        created_at: employeesTable.created_at,
        updated_at: employeesTable.updated_at,
        department_name: departmentsTable.name_ar,
        job_title_name: jobTitlesTable.name_ar,
        branch_name: branchesTable.name,
      })
      .from(employeesTable)
      .leftJoin(departmentsTable, eq(employeesTable.department_id, departmentsTable.id))
      .leftJoin(jobTitlesTable, eq(employeesTable.job_title_id, jobTitlesTable.id))
      .leftJoin(branchesTable, eq(employeesTable.branch_id, branchesTable.id))
      .where(and(...conditions))
      .orderBy(desc(employeesTable.created_at))
      .limit(limit)
      .offset(offset);

    const canViewSalary = hasPermission(req.user, 'can_view_employee_salary');
    res.json(
      rows.map((e) => ({
        ...e,
        salary: canViewSalary ? Number(e.salary) : null,
        commission_rate: e.commission_rate != null ? Number(e.commission_rate) : null,
        created_at: fmtTs(e.created_at),
        updated_at: fmtTs(e.updated_at),
      }))
    );
  })
);

router.post(
  '/employees',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_manage_employees')) {
      res.status(403).json({ error: 'غير مصرح بإضافة موظفين' });
      return;
    }
    const companyId = req.user!.company_id!;
    const userId = req.user?.id ?? null;

    const parsed = employeeCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'بيانات غير صحيحة' });
      return;
    }
    const data = parsed.data;

    if (new Date(data.hire_date) > new Date()) {
      res.status(400).json({ error: 'تاريخ التعيين لا يمكن أن يكون في المستقبل' });
      return;
    }

    if (data.national_id) {
      const dupNid = await db
        .select({ id: employeesTable.id })
        .from(employeesTable)
        .where(
          and(
            eq(employeesTable.company_id, companyId),
            eq(employeesTable.national_id, data.national_id),
            isNull(employeesTable.deleted_at)
          )
        );
      if (dupNid.length > 0) {
        res.status(409).json({ error: 'الرقم القومي مسجّل لموظف آخر' });
        return;
      }
    }

    const code = data.employee_code?.trim() || (await generateEmployeeCode(companyId));
    const dupCode = await db
      .select({ id: employeesTable.id })
      .from(employeesTable)
      .where(
        and(
          eq(employeesTable.company_id, companyId),
          eq(employeesTable.employee_code, code),
          isNull(employeesTable.deleted_at)
        )
      );
    if (dupCode.length > 0) {
      res.status(409).json({ error: 'كود الموظف مستخدم بالفعل' });
      return;
    }

    const [emp] = await db
      .insert(employeesTable)
      .values({
        company_id: companyId,
        employee_code: code,
        first_name_ar: data.first_name_ar.trim(),
        last_name_ar: data.last_name_ar.trim(),
        first_name_en: data.first_name_en?.trim() ?? '',
        last_name_en: data.last_name_en?.trim() ?? '',
        email: (data.email ?? '').toLowerCase().trim(),
        phone: data.phone ?? null,
        personal_phone: data.personal_phone ?? null,
        national_id: data.national_id ?? null,
        national_id_image: data.national_id_image ?? null,
        job_title_id: data.job_title_id ?? null,
        department_id: data.department_id ?? null,
        branch_id: data.branch_id ?? null,
        hire_date: data.hire_date,
        employment_status: 'active',
        salary: String(data.salary),
        currency: data.currency ?? 'EGP',
        salary_type: data.salary_type ?? 'fixed',
        commission_rate: data.commission_rate != null ? String(data.commission_rate) : null,
        commission_basis: data.commission_basis ?? null,
        commission_scope_dept_id: data.commission_scope_dept_id ?? null,
        bank_account: data.bank_account ?? null,
        address_ar: data.address_ar ?? null,
        address_en: data.address_en ?? null,
        city: data.city ?? null,
        country: data.country ?? 'مصر',
        notes: data.notes ?? null,
        created_by: userId,
        updated_by: userId,
      })
      .returning();

    await db.insert(employeeStatusHistoryTable).values({
      employee_id: emp.id,
      old_status: null,
      new_status: 'active',
      reason: 'تسجيل موظف جديد',
      changed_by: userId,
    });

    await writeAuditLog({
      action: 'create',
      record_type: 'employee',
      record_id: emp.id,
      new_value: { code, name: `${data.first_name_ar} ${data.last_name_ar}` },
      user: { id: userId ?? undefined, username: req.user?.username },
    });

    res.status(201).json(formatEmployee(emp as unknown as Record<string, unknown>));
  })
);

/* ── GET /employees/:id ─────────────────────────────────────── */
router.get(
  '/employees/:id',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_view_employees')) {
      res.status(403).json({ error: 'غير مصرح' });
      return;
    }
    const companyId = req.user!.company_id!;
    const id = parseInt(String(req.params['id']), 10);
    // Self-service: employee can only view own record
    const selfId = selfEmployeeId(req);
    if (selfId !== null && id !== selfId) {
      res.status(403).json({ error: 'غير مصرح' });
      return;
    }

    const rows = await db
      .select({
        id: employeesTable.id,
        company_id: employeesTable.company_id,
        employee_code: employeesTable.employee_code,
        first_name_ar: employeesTable.first_name_ar,
        last_name_ar: employeesTable.last_name_ar,
        first_name_en: employeesTable.first_name_en,
        last_name_en: employeesTable.last_name_en,
        email: employeesTable.email,
        phone: employeesTable.phone,
        personal_phone: employeesTable.personal_phone,
        national_id: employeesTable.national_id,
        national_id_image: employeesTable.national_id_image,
        job_title_id: employeesTable.job_title_id,
        department_id: employeesTable.department_id,
        branch_id: employeesTable.branch_id,
        hire_date: employeesTable.hire_date,
        employment_status: employeesTable.employment_status,
        salary: employeesTable.salary,
        currency: employeesTable.currency,
        salary_type: employeesTable.salary_type,
        commission_rate: employeesTable.commission_rate,
        commission_basis: employeesTable.commission_basis,
        commission_scope_dept_id: employeesTable.commission_scope_dept_id,
        bank_account: employeesTable.bank_account,
        address_ar: employeesTable.address_ar,
        address_en: employeesTable.address_en,
        city: employeesTable.city,
        country: employeesTable.country,
        notes: employeesTable.notes,
        created_at: employeesTable.created_at,
        updated_at: employeesTable.updated_at,
        deleted_at: employeesTable.deleted_at,
        created_by: employeesTable.created_by,
        department_name: departmentsTable.name_ar,
        job_title_name: jobTitlesTable.name_ar,
        branch_name: branchesTable.name,
      })
      .from(employeesTable)
      .leftJoin(departmentsTable, eq(employeesTable.department_id, departmentsTable.id))
      .leftJoin(jobTitlesTable, eq(employeesTable.job_title_id, jobTitlesTable.id))
      .leftJoin(branchesTable, eq(employeesTable.branch_id, branchesTable.id))
      .where(
        and(
          eq(employeesTable.id, id),
          eq(employeesTable.company_id, companyId),
          isNull(employeesTable.deleted_at)
        )
      );

    if (rows.length === 0) {
      res.status(404).json({ error: 'الموظف غير موجود' });
      return;
    }
    const e = rows[0];
    const canViewSalary = hasPermission(req.user, 'can_view_employee_salary');
    res.json({
      ...formatEmployee(e as unknown as Record<string, unknown>),
      salary: canViewSalary ? Number(e.salary) : null,
    });
  })
);

/* ── PUT /employees/:id ─────────────────────────────────────── */
router.put(
  '/employees/:id',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_manage_employees')) {
      res.status(403).json({ error: 'غير مصرح بتعديل الموظف' });
      return;
    }
    const companyId = req.user!.company_id!;
    const userId = req.user?.id ?? null;
    const id = parseInt(String(req.params['id']), 10);

    const parsed = employeeCreateSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'بيانات غير صحيحة' });
      return;
    }
    const data = parsed.data;

    const existing = await db
      .select()
      .from(employeesTable)
      .where(
        and(
          eq(employeesTable.id, id),
          eq(employeesTable.company_id, companyId),
          isNull(employeesTable.deleted_at)
        )
      );
    if (existing.length === 0) {
      res.status(404).json({ error: 'الموظف غير موجود' });
      return;
    }

    if (data.hire_date && new Date(data.hire_date) > new Date()) {
      res.status(400).json({ error: 'تاريخ التعيين لا يمكن أن يكون في المستقبل' });
      return;
    }

    const updates: Record<string, unknown> = { updated_by: userId, updated_at: new Date() };
    if (data.first_name_ar !== undefined) updates['first_name_ar'] = data.first_name_ar.trim();
    if (data.last_name_ar !== undefined) updates['last_name_ar'] = data.last_name_ar.trim();
    if (data.first_name_en !== undefined)
      updates['first_name_en'] = data.first_name_en?.trim() ?? '';
    if (data.last_name_en !== undefined) updates['last_name_en'] = data.last_name_en?.trim() ?? '';
    if (data.phone !== undefined) updates['phone'] = data.phone ?? null;
    if (data.personal_phone !== undefined) updates['personal_phone'] = data.personal_phone ?? null;
    if (data.national_id !== undefined) updates['national_id'] = data.national_id ?? null;
    if (data.job_title_id !== undefined) updates['job_title_id'] = data.job_title_id ?? null;
    if (data.department_id !== undefined) updates['department_id'] = data.department_id ?? null;
    if (data.branch_id !== undefined) updates['branch_id'] = data.branch_id ?? null;
    if (data.hire_date !== undefined) updates['hire_date'] = data.hire_date;
    if (data.salary !== undefined) updates['salary'] = String(data.salary);
    if (data.currency !== undefined) updates['currency'] = data.currency;
    if (data.salary_type !== undefined) updates['salary_type'] = data.salary_type;
    if (data.commission_rate !== undefined)
      updates['commission_rate'] =
        data.commission_rate != null ? String(data.commission_rate) : null;
    if (data.commission_basis !== undefined)
      updates['commission_basis'] = data.commission_basis ?? null;
    if (data.commission_scope_dept_id !== undefined)
      updates['commission_scope_dept_id'] = data.commission_scope_dept_id ?? null;
    if (data.national_id_image !== undefined)
      updates['national_id_image'] = data.national_id_image ?? null;
    if (data.bank_account !== undefined) updates['bank_account'] = data.bank_account ?? null;
    if (data.address_ar !== undefined) updates['address_ar'] = data.address_ar ?? null;
    if (data.address_en !== undefined) updates['address_en'] = data.address_en ?? null;
    if (data.city !== undefined) updates['city'] = data.city ?? null;
    if (data.country !== undefined) updates['country'] = data.country ?? null;
    if (data.notes !== undefined) updates['notes'] = data.notes ?? null;

    const [emp] = await db
      .update(employeesTable)
      .set(updates as any)
      .where(and(eq(employeesTable.id, id), eq(employeesTable.company_id, companyId)))
      .returning();

    await writeAuditLog({
      action: 'update',
      record_type: 'employee',
      record_id: id,
      new_value: updates,
      user: { id: userId ?? undefined, username: req.user?.username },
    });

    res.json(formatEmployee(emp as unknown as Record<string, unknown>));
  })
);

/* ── PATCH /employees/:id/status ────────────────────────────── */
router.patch(
  '/employees/:id/status',
  wrap(async (req, res) => {
    if (!requireHrAccess(req, res)) return;
    const companyId = req.user!.company_id!;
    const userId = req.user?.id ?? null;
    const id = parseInt(String(req.params['id']), 10);

    const { new_status, reason } = req.body as { new_status: string; reason?: string };
    const validStatuses = ['active', 'on_leave', 'suspended', 'terminated'];
    if (!validStatuses.includes(new_status)) {
      res.status(400).json({ error: `حالة الموظف يجب أن تكون: ${validStatuses.join(' | ')}` });
      return;
    }

    const [existing] = await db
      .select({ employment_status: employeesTable.employment_status })
      .from(employeesTable)
      .where(
        and(
          eq(employeesTable.id, id),
          eq(employeesTable.company_id, companyId),
          isNull(employeesTable.deleted_at)
        )
      );
    if (!existing) {
      res.status(404).json({ error: 'الموظف غير موجود' });
      return;
    }

    await db
      .update(employeesTable)
      .set({ employment_status: new_status, updated_by: userId, updated_at: new Date() })
      .where(and(eq(employeesTable.id, id), eq(employeesTable.company_id, companyId)));

    await db.insert(employeeStatusHistoryTable).values({
      employee_id: id,
      old_status: existing.employment_status,
      new_status,
      reason: reason ?? null,
      changed_by: userId,
    });

    await writeAuditLog({
      action: 'update',
      record_type: 'employee',
      record_id: id,
      new_value: { old_status: existing.employment_status, new_status, reason },
      user: { id: userId ?? undefined, username: req.user?.username },
    });

    res.json({ ok: true, new_status });
  })
);

/* ── DELETE /employees/:id ──────────────────────────────────── */
router.delete(
  '/employees/:id',
  wrap(async (req, res) => {
    if (!requireHrAccess(req, res)) return;
    const companyId = req.user!.company_id!;
    const userId = req.user?.id ?? null;
    const id = parseInt(String(req.params['id']), 10);

    const [emp] = await db
      .select({
        id: employeesTable.id,
        first_name_ar: employeesTable.first_name_ar,
        last_name_ar: employeesTable.last_name_ar,
      })
      .from(employeesTable)
      .where(
        and(
          eq(employeesTable.id, id),
          eq(employeesTable.company_id, companyId),
          isNull(employeesTable.deleted_at)
        )
      );
    if (!emp) {
      res.status(404).json({ error: 'الموظف غير موجود' });
      return;
    }

    await db
      .update(employeesTable)
      .set({ deleted_at: new Date(), employment_status: 'terminated', updated_by: userId })
      .where(and(eq(employeesTable.id, id), eq(employeesTable.company_id, companyId)));

    await db.insert(employeeStatusHistoryTable).values({
      employee_id: id,
      old_status: 'active',
      new_status: 'terminated',
      reason: 'حذف من النظام',
      changed_by: userId,
    });

    await writeAuditLog({
      action: 'delete',
      record_type: 'employee',
      record_id: id,
      new_value: { name: `${emp.first_name_ar} ${emp.last_name_ar}` },
      user: { id: userId ?? undefined, username: req.user?.username },
    });

    res.json({ ok: true });
  })
);

/* ═══════════════════════════════════════════════════════════════════
   EMPLOYEE DOCUMENTS
══════════════════════════════════════════════════════════════════════ */

router.get(
  '/employees/:id/documents',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_view_employees')) {
      res.status(403).json({ error: 'غير مصرح' });
      return;
    }
    const companyId = req.user!.company_id!;
    const id = parseInt(String(req.params['id']), 10);
    const emp = await db
      .select({ id: employeesTable.id })
      .from(employeesTable)
      .where(
        and(
          eq(employeesTable.id, id),
          eq(employeesTable.company_id, companyId),
          isNull(employeesTable.deleted_at)
        )
      );
    if (emp.length === 0) {
      res.status(404).json({ error: 'الموظف غير موجود' });
      return;
    }

    const docs = await db
      .select()
      .from(employeeDocumentsTable)
      .where(eq(employeeDocumentsTable.employee_id, id))
      .orderBy(desc(employeeDocumentsTable.created_at));
    res.json(
      docs.map((d) => ({
        ...d,
        created_at: fmtTs(d.created_at),
        updated_at: fmtTs(d.updated_at),
        verified_at: fmtTs(d.verified_at),
      }))
    );
  })
);

router.post(
  '/employees/:id/documents',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_manage_employees')) {
      res.status(403).json({ error: 'غير مصرح' });
      return;
    }
    const companyId = req.user!.company_id!;
    const id = parseInt(String(req.params['id']), 10);
    const { document_type, file_name, file_path, expiry_date, notes } = req.body as Record<
      string,
      string
    >;
    if (!document_type || !file_name) {
      res.status(400).json({ error: 'نوع المستند واسم الملف مطلوبان' });
      return;
    }
    const emp = await db
      .select({ id: employeesTable.id })
      .from(employeesTable)
      .where(
        and(
          eq(employeesTable.id, id),
          eq(employeesTable.company_id, companyId),
          isNull(employeesTable.deleted_at)
        )
      );
    if (emp.length === 0) {
      res.status(404).json({ error: 'الموظف غير موجود' });
      return;
    }

    const [doc] = await db
      .insert(employeeDocumentsTable)
      .values({
        employee_id: id,
        document_type,
        file_name,
        file_path: file_path ?? null,
        expiry_date: expiry_date ?? null,
        notes: notes ?? null,
      })
      .returning();
    res
      .status(201)
      .json({
        ...doc,
        created_at: fmtTs(doc.created_at),
        updated_at: fmtTs(doc.updated_at),
        verified_at: null,
      });
  })
);

router.patch(
  '/employees/:id/documents/:docId/verify',
  wrap(async (req, res) => {
    if (!requireHrAccess(req, res)) return;
    const companyId = req.user!.company_id!;
    const userId = req.user?.id ?? null;
    const id = parseInt(String(req.params['id']), 10);
    const docId = parseInt(String(req.params['docId']), 10);

    const emp = await db
      .select({ id: employeesTable.id })
      .from(employeesTable)
      .where(
        and(
          eq(employeesTable.id, id),
          eq(employeesTable.company_id, companyId),
          isNull(employeesTable.deleted_at)
        )
      );
    if (emp.length === 0) {
      res.status(404).json({ error: 'الموظف غير موجود' });
      return;
    }

    const [doc] = await db
      .update(employeeDocumentsTable)
      .set({ verified_by: userId, verified_at: new Date() })
      .where(and(eq(employeeDocumentsTable.id, docId), eq(employeeDocumentsTable.employee_id, id)))
      .returning();
    if (!doc) {
      res.status(404).json({ error: 'المستند غير موجود' });
      return;
    }
    res.json({ ok: true, verified_at: fmtTs(doc.verified_at) });
  })
);

router.delete(
  '/employees/:id/documents/:docId',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_manage_employees')) {
      res.status(403).json({ error: 'غير مصرح' });
      return;
    }
    const companyId = req.user!.company_id!;
    const id = parseInt(String(req.params['id']), 10);
    const docId = parseInt(String(req.params['docId']), 10);

    const emp = await db
      .select({ id: employeesTable.id })
      .from(employeesTable)
      .where(
        and(
          eq(employeesTable.id, id),
          eq(employeesTable.company_id, companyId),
          isNull(employeesTable.deleted_at)
        )
      );
    if (emp.length === 0) {
      res.status(404).json({ error: 'الموظف غير موجود' });
      return;
    }

    await db
      .delete(employeeDocumentsTable)
      .where(and(eq(employeeDocumentsTable.id, docId), eq(employeeDocumentsTable.employee_id, id)));
    res.json({ ok: true });
  })
);

/* ═══════════════════════════════════════════════════════════════════
   EMPLOYEE CONTACTS
══════════════════════════════════════════════════════════════════════ */

router.get(
  '/employees/:id/contacts',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_view_employees')) {
      res.status(403).json({ error: 'غير مصرح' });
      return;
    }
    const companyId = req.user!.company_id!;
    const id = parseInt(String(req.params['id']), 10);
    const emp = await db
      .select({ id: employeesTable.id })
      .from(employeesTable)
      .where(
        and(
          eq(employeesTable.id, id),
          eq(employeesTable.company_id, companyId),
          isNull(employeesTable.deleted_at)
        )
      );
    if (emp.length === 0) {
      res.status(404).json({ error: 'الموظف غير موجود' });
      return;
    }

    const contacts = await db
      .select()
      .from(employeeContactsTable)
      .where(eq(employeeContactsTable.employee_id, id))
      .orderBy(employeeContactsTable.id);
    res.json(contacts.map((c) => ({ ...c, created_at: fmtTs(c.created_at) })));
  })
);

router.post(
  '/employees/:id/contacts',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_manage_employees')) {
      res.status(403).json({ error: 'غير مصرح' });
      return;
    }
    const companyId = req.user!.company_id!;
    const id = parseInt(String(req.params['id']), 10);
    const { contact_type, name, relationship, phone, email } = req.body as Record<string, string>;
    if (!name?.trim()) {
      res.status(400).json({ error: 'اسم جهة الاتصال مطلوب' });
      return;
    }
    const emp = await db
      .select({ id: employeesTable.id })
      .from(employeesTable)
      .where(
        and(
          eq(employeesTable.id, id),
          eq(employeesTable.company_id, companyId),
          isNull(employeesTable.deleted_at)
        )
      );
    if (emp.length === 0) {
      res.status(404).json({ error: 'الموظف غير موجود' });
      return;
    }
    const [contact] = await db
      .insert(employeeContactsTable)
      .values({
        employee_id: id,
        contact_type: contact_type ?? 'emergency',
        name: name.trim(),
        relationship: relationship ?? null,
        phone: phone ?? null,
        email: email ?? null,
      })
      .returning();
    res.status(201).json({ ...contact, created_at: fmtTs(contact.created_at) });
  })
);

router.delete(
  '/employees/:id/contacts/:cid',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_manage_employees')) {
      res.status(403).json({ error: 'غير مصرح' });
      return;
    }
    const id = parseInt(String(req.params['id']), 10);
    const cid = parseInt(String(req.params['cid']), 10);
    await db
      .delete(employeeContactsTable)
      .where(and(eq(employeeContactsTable.id, cid), eq(employeeContactsTable.employee_id, id)));
    res.json({ ok: true });
  })
);

/* ═══════════════════════════════════════════════════════════════════
   EMPLOYEE STATUS HISTORY
══════════════════════════════════════════════════════════════════════ */

router.get(
  '/employees/:id/history',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_view_employees')) {
      res.status(403).json({ error: 'غير مصرح' });
      return;
    }
    const companyId = req.user!.company_id!;
    const id = parseInt(String(req.params['id']), 10);
    const emp = await db
      .select({ id: employeesTable.id })
      .from(employeesTable)
      .where(and(eq(employeesTable.id, id), eq(employeesTable.company_id, companyId)));
    if (emp.length === 0) {
      res.status(404).json({ error: 'الموظف غير موجود' });
      return;
    }

    const rows = await db
      .select()
      .from(employeeStatusHistoryTable)
      .where(eq(employeeStatusHistoryTable.employee_id, id))
      .orderBy(desc(employeeStatusHistoryTable.changed_at));
    res.json(rows.map((h) => ({ ...h, changed_at: fmtTs(h.changed_at) })));
  })
);

export default router;
