/**
 * Core employee CRUD routes — list, create, get, update, status, delete
 */
import { Router } from 'express';
import { eq, and, isNull, desc, ilike, or } from 'drizzle-orm';
import {
  db,
  employeesTable,
  employeeStatusHistoryTable,
  departmentsTable,
  jobTitlesTable,
  branchesTable,
  repairJobsTable,
  repairJobServicesTable,
  erpUsersTable,
  employeeCommissionLedgerTable,
} from '@workspace/db';
import { wrap } from '../../lib/async-handler';
import { hasPermission } from '../../lib/permissions';
import { selfEmployeeId } from '../../lib/employee-self';
import { writeAuditLog } from '../../lib/audit-log';
import { getTenant } from "../../middleware/auth";
import {
  fmtTs, formatEmployee, generateEmployeeCode, requireHrAccess, employeeCreateSchema,
} from './helpers';

const router = Router();

/* ── GET /employees ──────────────────────────────────────────── */
router.get('/employees', wrap(async (req, res) => {
  const selfId     = selfEmployeeId(req);
  const canViewAll = hasPermission(req.user, 'can_view_employees');
  if (!canViewAll && selfId === -1) { res.status(403).json({ error: 'غير مصرح بعرض الموظفين' }); return; }

  const companyId = getTenant(req);
  const search = String(req.query['search'] ?? '').trim();
  const deptId = req.query['department_id'] ? parseInt(String(req.query['department_id']), 10) : null;
  const status = String(req.query['status'] ?? '');
  const page   = Math.max(1, parseInt(String(req.query['page'] ?? '1'), 10));
  const limit  = Math.min(100, Math.max(1, parseInt(String(req.query['limit'] ?? '50'), 10)));
  const offset = (page - 1) * limit;

  const conditions = [eq(employeesTable.company_id, companyId), isNull(employeesTable.deleted_at)];
  if (selfId !== null && selfId !== -1) conditions.push(eq(employeesTable.id, selfId));
  if (deptId) conditions.push(eq(employeesTable.department_id, deptId));
  if (status) conditions.push(eq(employeesTable.employment_status, status));
  if (search) {
    conditions.push(or(
      ilike(employeesTable.first_name_ar, `%${search}%`),
      ilike(employeesTable.last_name_ar, `%${search}%`),
      ilike(employeesTable.first_name_en, `%${search}%`),
      ilike(employeesTable.last_name_en, `%${search}%`),
      ilike(employeesTable.employee_code, `%${search}%`),
      ilike(employeesTable.national_id, `%${search}%`)
    )!);
  }

  const rows = await db.select({
    id: employeesTable.id, company_id: employeesTable.company_id,
    employee_code: employeesTable.employee_code,
    first_name_ar: employeesTable.first_name_ar, last_name_ar: employeesTable.last_name_ar,
    first_name_en: employeesTable.first_name_en, last_name_en: employeesTable.last_name_en,
    email: employeesTable.email, phone: employeesTable.phone,
    national_id: employeesTable.national_id,
    job_title_id: employeesTable.job_title_id, department_id: employeesTable.department_id,
    branch_id: employeesTable.branch_id, hire_date: employeesTable.hire_date,
    employment_status: employeesTable.employment_status,
    salary: employeesTable.salary, currency: employeesTable.currency,
    salary_type: employeesTable.salary_type,
    commission_rate: employeesTable.commission_rate,
    commission_basis: employeesTable.commission_basis,
    commission_scope_dept_id: employeesTable.commission_scope_dept_id,
    created_at: employeesTable.created_at, updated_at: employeesTable.updated_at,
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
    .limit(limit).offset(offset);

  const canViewSalary = hasPermission(req.user, 'can_view_employee_salary');
  res.json(rows.map((e) => ({
    ...e,
    salary: canViewSalary ? Number(e.salary) : null,
    commission_rate: e.commission_rate != null ? Number(e.commission_rate) : null,
    created_at: fmtTs(e.created_at), updated_at: fmtTs(e.updated_at),
  })));
}));

/* ── POST /employees ─────────────────────────────────────────── */
router.post('/employees', wrap(async (req, res) => {
  if (!hasPermission(req.user, 'can_manage_employees')) { res.status(403).json({ error: 'غير مصرح بإضافة موظفين' }); return; }
  const companyId = getTenant(req);
  const userId    = req.user?.id ?? null;

  const parsed = employeeCreateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'بيانات غير صحيحة' }); return; }
  const data = parsed.data;

  if (new Date(data.hire_date) > new Date()) { res.status(400).json({ error: 'تاريخ التعيين لا يمكن أن يكون في المستقبل' }); return; }

  if (data.national_id) {
    const dupNid = await db.select({ id: employeesTable.id }).from(employeesTable)
      .where(and(eq(employeesTable.company_id, companyId), eq(employeesTable.national_id, data.national_id), isNull(employeesTable.deleted_at)));
    if (dupNid.length > 0) { res.status(409).json({ error: 'الرقم القومي مسجّل لموظف آخر' }); return; }
  }

  const code = data.employee_code?.trim() || (await generateEmployeeCode(companyId));
  const dupCode = await db.select({ id: employeesTable.id }).from(employeesTable)
    .where(and(eq(employeesTable.company_id, companyId), eq(employeesTable.employee_code, code), isNull(employeesTable.deleted_at)));
  if (dupCode.length > 0) { res.status(409).json({ error: 'كود الموظف مستخدم بالفعل' }); return; }

  const [emp] = await db.insert(employeesTable).values({
    company_id: companyId, employee_code: code,
    first_name_ar: data.first_name_ar.trim(), last_name_ar: data.last_name_ar.trim(),
    first_name_en: data.first_name_en?.trim() ?? '', last_name_en: data.last_name_en?.trim() ?? '',
    email: (data.email ?? '').toLowerCase().trim(),
    phone: data.phone ?? null, personal_phone: data.personal_phone ?? null,
    national_id: data.national_id ?? null, national_id_image: data.national_id_image ?? null,
    job_title_id: data.job_title_id ?? null, department_id: data.department_id ?? null,
    branch_id: data.branch_id ?? null, hire_date: data.hire_date,
    employment_status: 'active',
    salary: String(data.salary), currency: data.currency ?? 'EGP',
    salary_type: data.salary_type ?? 'fixed',
    commission_rate: data.commission_rate != null ? String(data.commission_rate) : null,
    commission_basis: data.commission_basis ?? null,
    commission_scope_dept_id: data.commission_scope_dept_id ?? null,
    bank_account: data.bank_account ?? null,
    address_ar: data.address_ar ?? null, address_en: data.address_en ?? null,
    city: data.city ?? null, country: data.country ?? 'مصر',
    notes: data.notes ?? null, created_by: userId, updated_by: userId,
  }).returning();

  await db.insert(employeeStatusHistoryTable).values({ employee_id: emp.id, old_status: null, new_status: 'active', reason: 'تسجيل موظف جديد', changed_by: userId });
  await writeAuditLog({ action: 'create', record_type: 'employee', record_id: emp.id, new_value: { code, name: `${data.first_name_ar} ${data.last_name_ar}` }, user: { id: userId ?? undefined, username: req.user?.username } });

  res.status(201).json(formatEmployee(emp as unknown as Record<string, unknown>));
}));

/* ── GET /employees/:id ──────────────────────────────────────── */
router.get('/employees/:id', wrap(async (req, res) => {
  const companyId = getTenant(req);
  const id        = parseInt(String(req.params['id']), 10);
  const selfId    = selfEmployeeId(req);
  const canViewAll = hasPermission(req.user, 'can_view_employees');
  const isSelf = selfId !== null && selfId === id;
  if (!canViewAll && !isSelf) { res.status(403).json({ error: 'غير مصرح' }); return; }
  if (canViewAll && selfId !== null && !isSelf) { res.status(403).json({ error: 'غير مصرح — يمكنك فقط الاطلاع على بياناتك' }); return; }

  const rows = await db.select({
    id: employeesTable.id, company_id: employeesTable.company_id,
    employee_code: employeesTable.employee_code,
    first_name_ar: employeesTable.first_name_ar, last_name_ar: employeesTable.last_name_ar,
    first_name_en: employeesTable.first_name_en, last_name_en: employeesTable.last_name_en,
    email: employeesTable.email, phone: employeesTable.phone, personal_phone: employeesTable.personal_phone,
    national_id: employeesTable.national_id, national_id_image: employeesTable.national_id_image,
    job_title_id: employeesTable.job_title_id, department_id: employeesTable.department_id,
    branch_id: employeesTable.branch_id, hire_date: employeesTable.hire_date,
    employment_status: employeesTable.employment_status,
    salary: employeesTable.salary, currency: employeesTable.currency,
    salary_type: employeesTable.salary_type, commission_rate: employeesTable.commission_rate,
    commission_basis: employeesTable.commission_basis,
    commission_scope_dept_id: employeesTable.commission_scope_dept_id,
    bank_account: employeesTable.bank_account,
    address_ar: employeesTable.address_ar, address_en: employeesTable.address_en,
    city: employeesTable.city, country: employeesTable.country,
    notes: employeesTable.notes,
    created_at: employeesTable.created_at, updated_at: employeesTable.updated_at,
    deleted_at: employeesTable.deleted_at, created_by: employeesTable.created_by,
    department_name: departmentsTable.name_ar,
    job_title_name: jobTitlesTable.name_ar,
    branch_name: branchesTable.name,
  })
    .from(employeesTable)
    .leftJoin(departmentsTable, eq(employeesTable.department_id, departmentsTable.id))
    .leftJoin(jobTitlesTable, eq(employeesTable.job_title_id, jobTitlesTable.id))
    .leftJoin(branchesTable, eq(employeesTable.branch_id, branchesTable.id))
    .where(and(eq(employeesTable.id, id), eq(employeesTable.company_id, companyId), isNull(employeesTable.deleted_at)));

  if (rows.length === 0) { res.status(404).json({ error: 'الموظف غير موجود' }); return; }
  const e = rows[0];
  const canViewSalary = hasPermission(req.user, 'can_view_employee_salary');
  res.json({ ...formatEmployee(e as unknown as Record<string, unknown>), salary: canViewSalary ? Number(e.salary) : null });
}));

/* ── PUT /employees/:id ──────────────────────────────────────── */
router.put('/employees/:id', wrap(async (req, res) => {
  if (!hasPermission(req.user, 'can_manage_employees')) { res.status(403).json({ error: 'غير مصرح بتعديل الموظف' }); return; }
  const companyId = getTenant(req);
  const userId    = req.user?.id ?? null;
  const id = parseInt(String(req.params['id']), 10);

  const parsed = employeeCreateSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'بيانات غير صحيحة' }); return; }
  const data = parsed.data;

  const existing = await db.select().from(employeesTable)
    .where(and(eq(employeesTable.id, id), eq(employeesTable.company_id, companyId), isNull(employeesTable.deleted_at)));
  if (existing.length === 0) { res.status(404).json({ error: 'الموظف غير موجود' }); return; }

  if (data.hire_date && new Date(data.hire_date) > new Date()) { res.status(400).json({ error: 'تاريخ التعيين لا يمكن أن يكون في المستقبل' }); return; }

  const updates: Record<string, unknown> = { updated_by: userId, updated_at: new Date() };
  if (data.first_name_ar !== undefined) updates['first_name_ar'] = data.first_name_ar.trim();
  if (data.last_name_ar !== undefined) updates['last_name_ar'] = data.last_name_ar.trim();
  if (data.first_name_en !== undefined) updates['first_name_en'] = data.first_name_en?.trim() ?? '';
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
  if (data.commission_rate !== undefined) updates['commission_rate'] = data.commission_rate != null ? String(data.commission_rate) : null;
  if (data.commission_basis !== undefined) updates['commission_basis'] = data.commission_basis ?? null;
  if (data.commission_scope_dept_id !== undefined) updates['commission_scope_dept_id'] = data.commission_scope_dept_id ?? null;
  if (data.national_id_image !== undefined) updates['national_id_image'] = data.national_id_image ?? null;
  if (data.bank_account !== undefined) updates['bank_account'] = data.bank_account ?? null;
  if (data.address_ar !== undefined) updates['address_ar'] = data.address_ar ?? null;
  if (data.address_en !== undefined) updates['address_en'] = data.address_en ?? null;
  if (data.city !== undefined) updates['city'] = data.city ?? null;
  if (data.country !== undefined) updates['country'] = data.country ?? null;
  if (data.notes !== undefined) updates['notes'] = data.notes ?? null;

  const [emp] = await db.update(employeesTable)
    .set(updates as Partial<typeof employeesTable.$inferInsert>)
    .where(and(eq(employeesTable.id, id), eq(employeesTable.company_id, companyId)))
    .returning();

  await writeAuditLog({ action: 'update', record_type: 'employee', record_id: id, new_value: updates, user: { id: userId ?? undefined, username: req.user?.username } });
  res.json(formatEmployee(emp as unknown as Record<string, unknown>));
}));

/* ── PATCH /employees/:id/status ─────────────────────────────── */
router.patch('/employees/:id/status', wrap(async (req, res) => {
  if (!requireHrAccess(req, res)) return;
  const companyId = getTenant(req);
  const userId    = req.user?.id ?? null;
  const id = parseInt(String(req.params['id']), 10);
  const { new_status, reason } = req.body as { new_status: string; reason?: string };
  const validStatuses = ['active', 'on_leave', 'suspended', 'terminated'];
  if (!validStatuses.includes(new_status)) { res.status(400).json({ error: `حالة الموظف يجب أن تكون: ${validStatuses.join(' | ')}` }); return; }

  const [existing] = await db.select({ employment_status: employeesTable.employment_status }).from(employeesTable)
    .where(and(eq(employeesTable.id, id), eq(employeesTable.company_id, companyId), isNull(employeesTable.deleted_at)));
  if (!existing) { res.status(404).json({ error: 'الموظف غير موجود' }); return; }

  await db.update(employeesTable).set({ employment_status: new_status, updated_by: userId, updated_at: new Date() })
    .where(and(eq(employeesTable.id, id), eq(employeesTable.company_id, companyId)));

  await db.insert(employeeStatusHistoryTable).values({ employee_id: id, old_status: existing.employment_status, new_status, reason: reason ?? null, changed_by: userId });
  await writeAuditLog({ action: 'update', record_type: 'employee', record_id: id, new_value: { old_status: existing.employment_status, new_status, reason }, user: { id: userId ?? undefined, username: req.user?.username } });
  res.json({ ok: true, new_status });
}));

/* ── DELETE /employees/:id ───────────────────────────────────── */
router.delete('/employees/:id', wrap(async (req, res) => {
  if (!requireHrAccess(req, res)) return;
  const companyId = getTenant(req);
  const userId    = req.user?.id ?? null;
  const id = parseInt(String(req.params['id']), 10);

  const [emp] = await db.select({ id: employeesTable.id, first_name_ar: employeesTable.first_name_ar, last_name_ar: employeesTable.last_name_ar }).from(employeesTable)
    .where(and(eq(employeesTable.id, id), eq(employeesTable.company_id, companyId), isNull(employeesTable.deleted_at)));
  if (!emp) { res.status(404).json({ error: 'الموظف غير موجود' }); return; }

  await db.update(employeesTable).set({ deleted_at: new Date(), employment_status: 'terminated', updated_by: userId })
    .where(and(eq(employeesTable.id, id), eq(employeesTable.company_id, companyId)));
  await db.insert(employeeStatusHistoryTable).values({ employee_id: id, old_status: 'active', new_status: 'terminated', reason: 'حذف من النظام', changed_by: userId });
  await writeAuditLog({ action: 'delete', record_type: 'employee', record_id: id, new_value: { name: `${emp.first_name_ar} ${emp.last_name_ar}` }, user: { id: userId ?? undefined, username: req.user?.username } });
  res.json({ ok: true });
}));

/* ── GET /employees/:id/maintenance-tab — تبويب الصيانة للإدارة ── */
router.get('/employees/:id/maintenance-tab', wrap(async (req, res) => {
  const canView = hasPermission(req.user, 'can_view_reports') || hasPermission(req.user, 'can_manage_employees');
  if (!canView) { res.status(403).json({ error: 'غير مصرح' }); return; }

  const companyId = getTenant(req);
  const empId = parseInt(String(req.params['id']), 10);
  if (!Number.isFinite(empId) || empId <= 0) { res.status(400).json({ error: 'معرّف الموظف غير صحيح' }); return; }

  /* Map employee_id → user_id (technician_id in repair_job_services = user.id) */
  const [userRow] = await db
    .select({ id: erpUsersTable.id })
    .from(erpUsersTable)
    .where(and(eq(erpUsersTable.employee_id, empId), eq(erpUsersTable.company_id, companyId)))
    .limit(1);

  const EMPTY = {
    employee_id: empId, has_user: false,
    total_assigned: 0, active_count: 0, delivered_count: 0,
    total_earned: 0, pending_commission: 0, avg_commission: 0,
    commission_services_count: 0, no_commission_services_count: 0,
    services: [],
  };
  if (!userRow) return res.json(EMPTY);

  const userId = userRow.id;

  /* جلب كل الخدمات لحساب KPIs + آخر 20 للعرض */
  const allRows = await db
    .select({
      id:                         repairJobServicesTable.id,
      job_id:                     repairJobServicesTable.job_id,
      job_no:                     repairJobsTable.job_no,
      customer_name:              repairJobsTable.customer_name,
      service_type_name_snapshot: repairJobServicesTable.service_type_name_snapshot,
      amount:                     repairJobServicesTable.amount,
      commission_computed:        repairJobServicesTable.commission_computed,
      commission_locked:          repairJobServicesTable.commission_locked,
      service_status:             repairJobServicesTable.status,
      job_status:                 repairJobsTable.status,
      created_at:                 repairJobServicesTable.created_at,
      delivered_at:               repairJobsTable.delivered_at,
    })
    .from(repairJobServicesTable)
    .innerJoin(repairJobsTable, eq(repairJobsTable.id, repairJobServicesTable.job_id))
    .where(and(
      eq(repairJobServicesTable.company_id, companyId),
      eq(repairJobServicesTable.technician_id, userId),
    ))
    .orderBy(desc(repairJobServicesTable.created_at));

  if (allRows.length === 0) return res.json({ ...EMPTY, has_user: true });

  /* KPIs */
  const ACTIVE_SVC = new Set(['pending', 'in_progress']);
  const FINAL_JOB  = new Set(['delivered', 'cancelled']);
  const totalAssigned  = allRows.length;
  const activeCount    = allRows.filter(r => ACTIVE_SVC.has(r.service_status) && !FINAL_JOB.has(r.job_status)).length;
  const deliveredCount = allRows.filter(r => r.commission_locked).length;
  const totalEarned    = allRows.filter(r => r.commission_locked).reduce((s, r) => s + Number(r.commission_computed ?? 0), 0);
  const pendingComm    = allRows.filter(r => !r.commission_locked && r.job_status !== 'cancelled').reduce((s, r) => s + Number(r.commission_computed ?? 0), 0);
  const avgCommission  = deliveredCount > 0 ? totalEarned / deliveredCount : 0;
  const commCount      = allRows.filter(r => r.commission_locked && Number(r.commission_computed ?? 0) > 0).length;
  const noCommCount    = allRows.filter(r => !r.commission_locked).length;

  /* آخر 20 خدمة للجدول — لا تُعاد commission_source_snapshot ولا commission_rate_snapshot */
  const services = allRows.slice(0, 20).map(r => ({
    id:               r.id,
    job_id:           r.job_id,
    job_no:           r.job_no,
    customer_name:    r.customer_name,
    service_type:     r.service_type_name_snapshot,
    amount:           Number(r.amount ?? 0),
    commission_computed: r.commission_locked ? Number(r.commission_computed ?? 0) : null,
    commission_locked:   r.commission_locked,
    service_status:   r.service_status,
    job_status:       r.job_status,
    created_at:       r.created_at,
    delivered_at:     r.delivered_at,
  }));

  return res.json({
    employee_id: empId,
    has_user: true,
    total_assigned:            totalAssigned,
    active_count:              activeCount,
    delivered_count:           deliveredCount,
    total_earned:              Number(totalEarned.toFixed(2)),
    pending_commission:        Number(pendingComm.toFixed(2)),
    avg_commission:            Number(avgCommission.toFixed(2)),
    commission_services_count: commCount,
    no_commission_services_count: noCommCount,
    services,
  });
}));

/* ── GET /employees/:id/repair-stats — إحصائيات إصلاح الفني ── */
router.get('/employees/:id/repair-stats', wrap(async (req, res) => {
  const canView = hasPermission(req.user, 'can_view_employees') || hasPermission(req.user, 'can_view_repairs');
  if (!canView) { res.status(403).json({ error: 'غير مصرح' }); return; }

  const companyId = getTenant(req);
  const empId = parseInt(String(req.params['id']), 10);
  if (!Number.isFinite(empId) || empId <= 0) { res.status(400).json({ error: 'معرّف الموظف غير صحيح' }); return; }

  const jobs = await db.select({
    id: repairJobsTable.id,
    job_no: repairJobsTable.job_no,
    customer_name: repairJobsTable.customer_name,
    device_brand: repairJobsTable.device_brand,
    device_model: repairJobsTable.device_model,
    status: repairJobsTable.status,
    final_cost: repairJobsTable.final_cost,
    received_at: repairJobsTable.received_at,
    delivered_at: repairJobsTable.delivered_at,
  }).from(repairJobsTable)
    .where(and(
      eq(repairJobsTable.company_id, companyId),
      or(
        eq(repairJobsTable.technician_id, empId),
        eq(repairJobsTable.technician_2_id, empId),
        eq(repairJobsTable.responsible_technician_id, empId),
      ),
    ))
    .orderBy(desc(repairJobsTable.created_at))
    .limit(200);

  const totalRevenue = jobs.reduce((sum, j) => sum + Number(j.final_cost ?? 0), 0);

  res.json({
    employee_id: empId,
    jobs_count: jobs.length,
    total_revenue: totalRevenue,
    jobs: jobs.map(j => ({
      ...j,
      final_cost: Number(j.final_cost ?? 0),
    })),
  });
}));

/* ── GET /employees/:id/commission-ledger ──────────────────────
 * يُعيد رصيد دفتر العمولات + جميع الحركات بالترتيب العكسي.
 * balance = SUM(amount) — موجب = دخل، سالب = صرف أو استرداد.
 * ──────────────────────────────────────────────────────────── */
router.get('/employees/:id/commission-ledger', wrap(async (req, res) => {
  const canView = hasPermission(req.user, 'can_view_reports') || hasPermission(req.user, 'can_manage_employees');
  if (!canView) { res.status(403).json({ error: 'غير مصرح' }); return; }

  const companyId = getTenant(req);
  const empId     = parseInt(String(req.params['id']), 10);
  if (!Number.isFinite(empId) || empId <= 0) { res.status(400).json({ error: 'معرّف الموظف غير صحيح' }); return; }

  const [emp] = await db.select({ id: employeesTable.id })
    .from(employeesTable)
    .where(and(eq(employeesTable.id, empId), eq(employeesTable.company_id, companyId), isNull(employeesTable.deleted_at)));
  if (!emp) { res.status(404).json({ error: 'الموظف غير موجود' }); return; }

  const entries = await db.select()
    .from(employeeCommissionLedgerTable)
    .where(and(
      eq(employeeCommissionLedgerTable.employee_id, empId),
      eq(employeeCommissionLedgerTable.company_id, companyId),
    ))
    .orderBy(desc(employeeCommissionLedgerTable.created_at));

  const balance     = entries.reduce((s, e) => s + Number(e.amount), 0);
  const totalEarned = entries.filter(e => Number(e.amount) > 0).reduce((s, e) => s + Number(e.amount), 0);
  const totalPaid   = entries.filter(e => Number(e.amount) < 0).reduce((s, e) => s + Math.abs(Number(e.amount)), 0);

  return res.json({
    employee_id: empId,
    balance:      Number(balance.toFixed(2)),
    total_earned: Number(totalEarned.toFixed(2)),
    total_paid:   Number(totalPaid.toFixed(2)),
    entries:      entries.map(e => ({ ...e, amount: Number(e.amount) })),
  });
}));

/* ── POST /employees/:id/commission-ledger ─────────────────────
 * إنشاء حركة يدوية في دفتر العمولات (صرف، تعديل، حافز…).
 * الأنواع المتاحة: commission_earned | payout | reversal | bonus | adjustment | incentive
 * القاعدة: payout و reversal دائماً بالقيمة السالبة (تُطبَّق تلقائياً).
 * ──────────────────────────────────────────────────────────── */
router.post('/employees/:id/commission-ledger', wrap(async (req, res) => {
  if (!hasPermission(req.user, 'can_manage_employees')) {
    res.status(403).json({ error: 'غير مصرح — يلزم صلاحية إدارة الموظفين' }); return;
  }

  const companyId = getTenant(req);
  const empId     = parseInt(String(req.params['id']), 10);
  if (!Number.isFinite(empId) || empId <= 0) { res.status(400).json({ error: 'معرّف الموظف غير صحيح' }); return; }

  const [emp] = await db.select({ id: employeesTable.id })
    .from(employeesTable)
    .where(and(eq(employeesTable.id, empId), eq(employeesTable.company_id, companyId), isNull(employeesTable.deleted_at)));
  if (!emp) { res.status(404).json({ error: 'الموظف غير موجود' }); return; }

  const body = req.body as Record<string, unknown>;
  const { entry_type, amount: rawAmount, reference_type, reference_id, reference_no, description, date, notes } = body;

  const VALID_TYPES = ['commission_earned', 'payout', 'reversal', 'bonus', 'adjustment', 'incentive'];
  if (typeof entry_type !== 'string' || !VALID_TYPES.includes(entry_type)) {
    res.status(400).json({ error: `entry_type غير صالح. المتاح: ${VALID_TYPES.join(', ')}` }); return;
  }

  const inputAmount = Number(rawAmount);
  if (!Number.isFinite(inputAmount) || inputAmount === 0) {
    res.status(400).json({ error: 'المبلغ يجب أن يكون رقماً غير صفري' }); return;
  }

  /* payout و reversal دائماً سالبة — أي قيمة موجبة تُعكس تلقائياً */
  const DEBIT_TYPES = ['payout', 'reversal'];
  const finalAmount = DEBIT_TYPES.includes(entry_type)
    ? -Math.abs(inputAmount)
    : Math.abs(inputAmount);

  /* للخصم: تحقق من توفر الرصيد الكافي */
  if (DEBIT_TYPES.includes(entry_type)) {
    const existing = await db.select({ amount: employeeCommissionLedgerTable.amount })
      .from(employeeCommissionLedgerTable)
      .where(and(
        eq(employeeCommissionLedgerTable.employee_id, empId),
        eq(employeeCommissionLedgerTable.company_id, companyId),
      ));
    const currentBalance = existing.reduce((s, e) => s + Number(e.amount), 0);
    if (Math.abs(inputAmount) > currentBalance + 0.01) {
      res.status(409).json({
        error:             'المبلغ يتجاوز الرصيد المتاح',
        available_balance: Number(currentBalance.toFixed(2)),
      }); return;
    }
  }

  const entryDate = typeof date === 'string' && date ? date : new Date().toISOString().split('T')[0];
  const userId    = req.user?.id ?? null;

  const [newEntry] = await db.insert(employeeCommissionLedgerTable).values({
    company_id:     companyId,
    employee_id:    empId,
    entry_type,
    amount:         String(finalAmount.toFixed(2)),
    reference_type: typeof reference_type === 'string' ? reference_type : null,
    reference_id:   typeof reference_id   === 'number' ? reference_id   : null,
    reference_no:   typeof reference_no   === 'string' ? reference_no   : null,
    description:    typeof description    === 'string' ? description    : null,
    date:           entryDate,
    created_by:     userId,
    notes:          typeof notes === 'string' ? notes : null,
  }).returning();

  /* رصيد محدَّث بعد الإدراج */
  const allEntries = await db.select({ amount: employeeCommissionLedgerTable.amount })
    .from(employeeCommissionLedgerTable)
    .where(and(
      eq(employeeCommissionLedgerTable.employee_id, empId),
      eq(employeeCommissionLedgerTable.company_id, companyId),
    ));
  const newBalance = allEntries.reduce((s, e) => s + Number(e.amount), 0);

  void writeAuditLog({
    action:      'commission_ledger_entry',
    record_type: 'employee_commission_ledger',
    record_id:   newEntry.id,
    new_value:   { entry_type, amount: finalAmount, employee_id: empId },
    user:        { id: userId ?? 0, username: String(req.user?.username ?? '') },
    company_id:  companyId,
  });

  return res.status(201).json({
    ok:          true,
    entry:       { ...newEntry, amount: Number(newEntry.amount) },
    new_balance: Number(newBalance.toFixed(2)),
  });
}));

export default router;
