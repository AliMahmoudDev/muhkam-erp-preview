/**
 * /api/leave-types, /api/leave-policies, /api/leave-requests
 * Full leave management with balance tracking, approval workflow, and accrual.
 */
import { Router, type IRouter } from "express";
import { eq, and, desc, or, gte, lte, sql } from "drizzle-orm";
import {
  db,
  leaveTypesTable, leavePoliciesTable, employeeLeaveBalancesTable,
  leaveRequestsTable, leaveApprovalsTable, leaveAccrualHistoryTable,
  leaveBlackoutDatesTable, employeesTable,
} from "@workspace/db";
import { z } from "zod/v4";
import { firstZodError } from "../lib/schemas";
import { wrap } from "../lib/async-handler";
import { hasPermission } from "../lib/permissions";
import { selfEmployeeId, isSelfServiceUser } from "../lib/employee-self";
import { requireFeature } from "../middleware/feature-guard";
import { getTenant } from "../middleware/auth";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const createLeaveTypeSchema = z.object({
  name_ar: z.string().min(1),
  code: z.string().min(1),
  name_en: z.string().optional().nullable(),
  is_paid: z.boolean().optional(),
  requires_approval: z.boolean().optional(),
  carryover_allowed: z.boolean().optional(),
  carryover_limit: z.number().optional().nullable(),
});

const updateLeaveTypeSchema = z.object({
  name_ar: z.string().min(1).optional(),
  name_en: z.string().optional().nullable(),
  is_paid: z.boolean().optional(),
  requires_approval: z.boolean().optional(),
  carryover_allowed: z.boolean().optional(),
  carryover_limit: z.number().optional().nullable(),
  is_active: z.boolean().optional(),
});

const createLeavePolicySchema = z.object({
  leave_type_id: z.union([z.string(), z.number()]).refine(v => Number(v) > 0),
  entitlement_days_per_year: z.number().optional(),
  accrual_method: z.string().optional().nullable(),
  min_duration: z.number().optional().nullable(),
  max_consecutive_days: z.number().optional().nullable(),
  probation_days: z.number().optional(),
});

const updateLeavePolicySchema = z.object({
  entitlement_days_per_year: z.number().optional(),
  accrual_method: z.string().optional().nullable(),
  min_duration: z.number().optional().nullable(),
  max_consecutive_days: z.number().optional().nullable(),
  probation_days: z.number().optional(),
});

const createLeaveRequestSchema = z.object({
  leave_type_id: z.union([z.string(), z.number()]).refine(v => Number(v) > 0),
  start_date: z.string().regex(dateRegex),
  end_date: z.string().regex(dateRegex),
  employee_id: z.union([z.string(), z.number()]).optional().nullable(),
  reason: z.string().optional().nullable(),
});

const approveLeaveSchema = z.object({
  comment: z.string().optional().nullable(),
});

const rejectLeaveSchema = z.object({
  reason: z.string().optional().nullable(),
});

const accrualRunSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional().nullable(),
});

const createBlackoutSchema = z.object({
  start_date: z.string().regex(dateRegex),
  end_date: z.string().regex(dateRegex),
  reason_ar: z.string().optional().nullable(),
  reason_en: z.string().optional().nullable(),
});

const router: IRouter = Router();
router.use(["/leave-types", "/leave-policies", "/leave-requests", "/leave-accrual", "/leave-blackout-dates", "/employee-leave-balance"], requireFeature("hr"));
function fmt(v: Date | null | undefined) { return v instanceof Date ? v.toISOString() : (v ?? null); }
function numStr(v: unknown) { return v != null ? Number(v) : 0; }

/* ═══════════════════════════════════════════════════════════════════
   LEAVE TYPES
══════════════════════════════════════════════════════════════════════ */

router.get("/leave-types", wrap(async (req, res) => {
  const companyId = getTenant(req);
  const rows = await db.select().from(leaveTypesTable)
    .where(and(eq(leaveTypesTable.company_id, companyId), eq(leaveTypesTable.is_active, true)))
    .orderBy(leaveTypesTable.name_ar);
  res.json(rows.map(r => ({ ...r, created_at: fmt(r.created_at) })));
}));

router.post("/leave-types", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_employees")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const parsedLT = createLeaveTypeSchema.safeParse(req.body);
  if (!parsedLT.success) { res.status(400).json({ error: firstZodError(parsedLT.error) }); return; }
  const companyId = getTenant(req);
  const { name_ar, name_en, code, is_paid, requires_approval, carryover_allowed, carryover_limit } = parsedLT.data;
  const [row] = await db.insert(leaveTypesTable).values({
    company_id: companyId, name_ar: String(name_ar), name_en: String(name_en ?? name_ar),
    code: String(code).toUpperCase(), is_paid: Boolean(is_paid !== false),
    requires_approval: Boolean(requires_approval !== false),
    carryover_allowed: Boolean(carryover_allowed),
    carryover_limit: carryover_allowed ? (Number(carryover_limit) || 0) : null,
  }).returning();
  res.status(201).json({ ...row, created_at: fmt(row.created_at) });
}));

router.put("/leave-types/:id", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_employees")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const parsedLTU = updateLeaveTypeSchema.safeParse(req.body);
  if (!parsedLTU.success) { res.status(400).json({ error: firstZodError(parsedLTU.error) }); return; }
  const companyId = getTenant(req);
  const id = parseInt(String(req.params["id"]), 10);
  const { name_ar, name_en, is_paid, requires_approval, carryover_allowed, carryover_limit, is_active } = parsedLTU.data;
  const [row] = await db.update(leaveTypesTable)
    .set({ name_ar: String(name_ar ?? ""), name_en: String(name_en ?? name_ar ?? ""), is_paid: Boolean(is_paid !== false), requires_approval: Boolean(requires_approval !== false), carryover_allowed: Boolean(carryover_allowed), carryover_limit: carryover_allowed ? (Number(carryover_limit) || 0) : null, is_active: Boolean(is_active !== false) })
    .where(and(eq(leaveTypesTable.id, id), eq(leaveTypesTable.company_id, companyId)))
    .returning();
  if (!row) { res.status(404).json({ error: "نوع الإجازة غير موجود" }); return; }
  res.json({ ...row, created_at: fmt(row.created_at) });
}));

/* ═══════════════════════════════════════════════════════════════════
   LEAVE POLICIES
══════════════════════════════════════════════════════════════════════ */

router.get("/leave-policies", wrap(async (req, res) => {
  const companyId = getTenant(req);
  const rows = await db.select({
    id: leavePoliciesTable.id, company_id: leavePoliciesTable.company_id,
    leave_type_id: leavePoliciesTable.leave_type_id, entitlement_days_per_year: leavePoliciesTable.entitlement_days_per_year,
    accrual_method: leavePoliciesTable.accrual_method, min_duration: leavePoliciesTable.min_duration,
    max_consecutive_days: leavePoliciesTable.max_consecutive_days, probation_days: leavePoliciesTable.probation_days,
    created_at: leavePoliciesTable.created_at, leave_type_name_ar: leaveTypesTable.name_ar,
  })
    .from(leavePoliciesTable)
    .leftJoin(leaveTypesTable, eq(leavePoliciesTable.leave_type_id, leaveTypesTable.id))
    .where(eq(leavePoliciesTable.company_id, companyId));
  res.json(rows.map(r => ({ ...r, min_duration: Number(r.min_duration), created_at: fmt(r.created_at) })));
}));

router.post("/leave-policies", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_employees")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const parsedLP = createLeavePolicySchema.safeParse(req.body);
  if (!parsedLP.success) { res.status(400).json({ error: firstZodError(parsedLP.error) }); return; }
  const companyId = getTenant(req);
  const { leave_type_id, entitlement_days_per_year, accrual_method, min_duration, max_consecutive_days, probation_days } = parsedLP.data;
  const [row] = await db.insert(leavePoliciesTable).values({
    company_id: companyId, leave_type_id: Number(leave_type_id),
    entitlement_days_per_year: Number(entitlement_days_per_year) || 21,
    accrual_method: String(accrual_method ?? "fixed"),
    min_duration: String(Number(min_duration) || 1),
    max_consecutive_days: max_consecutive_days ? Number(max_consecutive_days) : null,
    probation_days: Number(probation_days) || 90,
  }).returning();
  res.status(201).json({ ...row, min_duration: Number(row.min_duration), created_at: fmt(row.created_at) });
}));

router.put("/leave-policies/:id", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_employees")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const parsedLPU = updateLeavePolicySchema.safeParse(req.body);
  if (!parsedLPU.success) { res.status(400).json({ error: firstZodError(parsedLPU.error) }); return; }
  const companyId = getTenant(req);
  const id = parseInt(String(req.params["id"]), 10);
  const { entitlement_days_per_year, accrual_method, min_duration, max_consecutive_days, probation_days } = parsedLPU.data;
  const [row] = await db.update(leavePoliciesTable)
    .set({ entitlement_days_per_year: Number(entitlement_days_per_year) || 21, accrual_method: String(accrual_method ?? "fixed"), min_duration: String(Number(min_duration) || 1), max_consecutive_days: max_consecutive_days ? Number(max_consecutive_days) : null, probation_days: Number(probation_days) || 90, updated_at: new Date() })
    .where(and(eq(leavePoliciesTable.id, id), eq(leavePoliciesTable.company_id, companyId)))
    .returning();
  if (!row) { res.status(404).json({ error: "السياسة غير موجودة" }); return; }
  res.json({ ...row, min_duration: Number(row.min_duration), created_at: fmt(row.created_at) });
}));

/* ═══════════════════════════════════════════════════════════════════
   LEAVE BALANCES
══════════════════════════════════════════════════════════════════════ */

router.get("/employee-leave-balance/:employeeId", wrap(async (req, res) => {
  const selfId  = selfEmployeeId(req);
  const empId   = parseInt(String(req.params["employeeId"]), 10);
  // selfId=-1 → no access; selfId=N → can only see own record; selfId=null → admin can see all
  if (selfId === -1) { res.status(403).json({ error: "غير مصرح" }); return; }
  if (selfId !== null && selfId !== empId) { res.status(403).json({ error: "غير مصرح" }); return; }
  const rows = await db.select({
    id: employeeLeaveBalancesTable.id, employee_id: employeeLeaveBalancesTable.employee_id,
    leave_type_id: employeeLeaveBalancesTable.leave_type_id,
    accrued_days: employeeLeaveBalancesTable.accrued_days, used_days: employeeLeaveBalancesTable.used_days,
    balance_days: employeeLeaveBalancesTable.balance_days, carryover_days: employeeLeaveBalancesTable.carryover_days,
    as_of_date: employeeLeaveBalancesTable.as_of_date, created_at: employeeLeaveBalancesTable.created_at,
    leave_type_name_ar: leaveTypesTable.name_ar, leave_type_code: leaveTypesTable.code,
  })
    .from(employeeLeaveBalancesTable)
    .leftJoin(leaveTypesTable, eq(employeeLeaveBalancesTable.leave_type_id, leaveTypesTable.id))
    .where(eq(employeeLeaveBalancesTable.employee_id, empId));
  res.json(rows.map(r => ({
    ...r, accrued_days: numStr(r.accrued_days), used_days: numStr(r.used_days),
    balance_days: numStr(r.balance_days), carryover_days: numStr(r.carryover_days), created_at: fmt(r.created_at),
  })));
}));

/* ═══════════════════════════════════════════════════════════════════
   LEAVE REQUESTS
══════════════════════════════════════════════════════════════════════ */

router.get("/leave-requests", wrap(async (req, res) => {
  const selfId = selfEmployeeId(req);
  // selfId=-1 means no employee_id and no permission → deny
  if (selfId === -1) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = getTenant(req);
  const queryEmpId = req.query["employee_id"] ? parseInt(String(req.query["employee_id"]), 10) : null;
  // If user has an employee_id, always restrict to their own records
  const empId = (selfId !== null) ? selfId : queryEmpId;
  const status  = String(req.query["status"] ?? "");
  const from    = String(req.query["from"] ?? "");
  const to      = String(req.query["to"] ?? "");

  const conditions = [eq(employeesTable.company_id, companyId)];
  if (empId)  conditions.push(eq(leaveRequestsTable.employee_id, empId));
  if (status) conditions.push(eq(leaveRequestsTable.status, status));
  if (from)   conditions.push(gte(leaveRequestsTable.start_date, from));
  if (to)     conditions.push(lte(leaveRequestsTable.end_date, to));

  const rows = await db.select({
    id: leaveRequestsTable.id, employee_id: leaveRequestsTable.employee_id,
    leave_type_id: leaveRequestsTable.leave_type_id, start_date: leaveRequestsTable.start_date,
    end_date: leaveRequestsTable.end_date, total_days: leaveRequestsTable.total_days,
    status: leaveRequestsTable.status, reason: leaveRequestsTable.reason,
    rejection_reason: leaveRequestsTable.rejection_reason,
    submitted_at: leaveRequestsTable.submitted_at, created_at: leaveRequestsTable.created_at,
    first_name_ar: employeesTable.first_name_ar, last_name_ar: employeesTable.last_name_ar,
    employee_code: employeesTable.employee_code, leave_type_name_ar: leaveTypesTable.name_ar,
  })
    .from(leaveRequestsTable)
    .leftJoin(employeesTable, eq(leaveRequestsTable.employee_id, employeesTable.id))
    .leftJoin(leaveTypesTable, eq(leaveRequestsTable.leave_type_id, leaveTypesTable.id))
    .where(and(...conditions))
    .orderBy(desc(leaveRequestsTable.submitted_at))
    .limit(200);

  res.json(rows.map(r => ({ ...r, total_days: numStr(r.total_days), submitted_at: fmt(r.submitted_at), created_at: fmt(r.created_at) })));
}));

router.post("/leave-requests", wrap(async (req, res) => {
  const companyId = getTenant(req);
  const userId    = req.user?.id ?? null;
  const isSelf    = isSelfServiceUser(req);
  const selfId    = selfEmployeeId(req);
  if (isSelf && (!selfId || selfId === -1)) { res.status(403).json({ error: "حساب الموظف غير مرتبط بسجل موظف" }); return; }
  const parsedLR = createLeaveRequestSchema.safeParse(req.body);
  if (!parsedLR.success) { res.status(400).json({ error: firstZodError(parsedLR.error) }); return; }
  let { employee_id } = parsedLR.data;
  const { leave_type_id, start_date, end_date, reason } = parsedLR.data;
  // Self-service: always restrict to own employee_id
  if (isSelf) employee_id = selfId;
  if (!employee_id) { res.status(400).json({ error: "معرف الموظف مطلوب" }); return; }
  if (new Date(String(start_date)) > new Date(String(end_date))) { res.status(400).json({ error: "تاريخ البداية يجب أن يكون قبل تاريخ النهاية" }); return; }

  // Verify employee belongs to this company
  const [emp] = await db.select({ id: employeesTable.id, hire_date: employeesTable.hire_date }).from(employeesTable)
    .where(and(eq(employeesTable.id, Number(employee_id)), eq(employeesTable.company_id, companyId)));
  if (!emp) { res.status(404).json({ error: "الموظف غير موجود" }); return; }

  // Calculate total days
  const start = new Date(String(start_date));
  const end = new Date(String(end_date));
  const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  // Check for overlapping requests
  const overlap = await db.select({ id: leaveRequestsTable.id }).from(leaveRequestsTable)
    .where(and(eq(leaveRequestsTable.employee_id, Number(employee_id)),
      sql`status NOT IN ('rejected','cancelled')`,
      or(
        and(lte(leaveRequestsTable.start_date, String(start_date)), gte(leaveRequestsTable.end_date, String(start_date))),
        and(lte(leaveRequestsTable.start_date, String(end_date)), gte(leaveRequestsTable.end_date, String(end_date)))
      )!));
  if (overlap.length > 0) { res.status(409).json({ error: "يوجد طلب إجازة متداخل خلال هذه الفترة" }); return; }

  // Check leave balance
  const [balance] = await db.select().from(employeeLeaveBalancesTable)
    .where(and(eq(employeeLeaveBalancesTable.employee_id, Number(employee_id)), eq(employeeLeaveBalancesTable.leave_type_id, Number(leave_type_id))));
  if (balance && Number(balance.balance_days) < totalDays) {
    res.status(422).json({ error: `رصيد الإجازة غير كافٍ. المتاح: ${balance.balance_days} يوم، المطلوب: ${totalDays} يوم` }); return;
  }

  // Check blackout dates
  const blackout = await db.select({ id: leaveBlackoutDatesTable.id, reason_ar: leaveBlackoutDatesTable.reason_ar }).from(leaveBlackoutDatesTable)
    .where(and(eq(leaveBlackoutDatesTable.company_id, companyId),
      or(and(lte(leaveBlackoutDatesTable.start_date, String(end_date)), gte(leaveBlackoutDatesTable.end_date, String(start_date))))!));
  if (blackout.length > 0) { res.status(422).json({ error: `لا يمكن تقديم إجازة خلال هذه الفترة: ${blackout[0]?.reason_ar ?? "فترة محظورة"}` }); return; }

  // Fetch leave type to check if approval required
  const [leaveType] = await db.select().from(leaveTypesTable).where(eq(leaveTypesTable.id, Number(leave_type_id)));

  const initialStatus = leaveType?.requires_approval ? "pending" : "approved";
  const [request] = await db.insert(leaveRequestsTable).values({
    employee_id: Number(employee_id), leave_type_id: Number(leave_type_id),
    start_date: String(start_date), end_date: String(end_date),
    total_days: String(totalDays), status: initialStatus,
    reason: (reason as string) ?? null,
    approved_by: !leaveType?.requires_approval ? userId : null,
    approved_at: !leaveType?.requires_approval ? new Date() : null,
  }).returning();

  // Deduct from balance immediately if auto-approved
  if (initialStatus === "approved" && balance) {
    const newUsed = Number(balance.used_days) + totalDays;
    const newBalance = Number(balance.balance_days) - totalDays;
    await db.update(employeeLeaveBalancesTable)
      .set({ used_days: String(newUsed), balance_days: String(Math.max(0, newBalance)), updated_at: new Date(), as_of_date: new Date().toISOString().split("T")[0] })
      .where(eq(employeeLeaveBalancesTable.id, balance.id));
  }

  res.status(201).json({ ...request, total_days: numStr(request.total_days), submitted_at: fmt(request.submitted_at), created_at: fmt(request.created_at) });
}));

router.get("/leave-requests/:id", wrap(async (req, res) => {
  const companyId = getTenant(req);
  const id = parseInt(String(req.params["id"]), 10);
  if (isNaN(id)) { res.status(400).json({ error: "معرف غير صحيح" }); return; }
  const [request] = await db.select({
    id: leaveRequestsTable.id, employee_id: leaveRequestsTable.employee_id,
    leave_type_id: leaveRequestsTable.leave_type_id, start_date: leaveRequestsTable.start_date,
    end_date: leaveRequestsTable.end_date, total_days: leaveRequestsTable.total_days,
    status: leaveRequestsTable.status, reason: leaveRequestsTable.reason,
    rejection_reason: leaveRequestsTable.rejection_reason,
    submitted_at: leaveRequestsTable.submitted_at, approved_at: leaveRequestsTable.approved_at,
    created_at: leaveRequestsTable.created_at,
    first_name_ar: employeesTable.first_name_ar, last_name_ar: employeesTable.last_name_ar,
    leave_type_name_ar: leaveTypesTable.name_ar, is_paid: leaveTypesTable.is_paid,
  })
    .from(leaveRequestsTable)
    .innerJoin(employeesTable, and(eq(leaveRequestsTable.employee_id, employeesTable.id), eq(employeesTable.company_id, companyId)))
    .leftJoin(leaveTypesTable, eq(leaveRequestsTable.leave_type_id, leaveTypesTable.id))
    .where(eq(leaveRequestsTable.id, id));
  if (!request) { res.status(404).json({ error: "الطلب غير موجود" }); return; }
  res.json({ ...request, total_days: numStr(request.total_days), submitted_at: fmt(request.submitted_at), approved_at: fmt(request.approved_at), created_at: fmt(request.created_at) });
}));

/* ── Approve / Reject ─────────────────────────────────────────── */
router.post("/leave-requests/:id/approve", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_employees")) { res.status(403).json({ error: "غير مصرح بالاعتماد" }); return; }
  const parsedApprove = approveLeaveSchema.safeParse(req.body);
  if (!parsedApprove.success) { res.status(400).json({ error: firstZodError(parsedApprove.error) }); return; }
  const companyId = getTenant(req);
  const userId = req.user?.id ?? null;
  const id = parseInt(String(req.params["id"]), 10);
  const { comment } = parsedApprove.data;

  const [request] = await db.select({ lr: leaveRequestsTable }).from(leaveRequestsTable)
    .innerJoin(employeesTable, and(eq(leaveRequestsTable.employee_id, employeesTable.id), eq(employeesTable.company_id, companyId)))
    .where(eq(leaveRequestsTable.id, id))
    .then(rows => rows.map(r => r.lr));
  if (!request) { res.status(404).json({ error: "الطلب غير موجود" }); return; }
  if (request.status !== "pending") { res.status(409).json({ error: "الطلب غير معلّق" }); return; }

  await db.update(leaveRequestsTable)
    .set({ status: "approved", approved_by: userId, approved_at: new Date(), updated_at: new Date() })
    .where(eq(leaveRequestsTable.id, id));

  await db.insert(leaveApprovalsTable).values({
    leave_request_id: id, approver_id: userId ?? 0, status: "approved", comment: comment ?? null,
  });

  // Deduct from leave balance
  const [balance] = await db.select().from(employeeLeaveBalancesTable)
    .where(and(eq(employeeLeaveBalancesTable.employee_id, request.employee_id), eq(employeeLeaveBalancesTable.leave_type_id, request.leave_type_id)));
  if (balance) {
    const totalDays = Number(request.total_days);
    await db.update(employeeLeaveBalancesTable)
      .set({ used_days: String(Number(balance.used_days) + totalDays), balance_days: String(Math.max(0, Number(balance.balance_days) - totalDays)), updated_at: new Date(), as_of_date: new Date().toISOString().split("T")[0] })
      .where(eq(employeeLeaveBalancesTable.id, balance.id));
  }

  res.json({ ok: true, status: "approved" });
}));

router.post("/leave-requests/:id/reject", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_employees")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const parsedReject = rejectLeaveSchema.safeParse(req.body);
  if (!parsedReject.success) { res.status(400).json({ error: firstZodError(parsedReject.error) }); return; }
  const companyId = getTenant(req);
  const userId = req.user?.id ?? null;
  const id = parseInt(String(req.params["id"]), 10);
  const { reason } = parsedReject.data;

  const [request] = await db.select({ lr: leaveRequestsTable }).from(leaveRequestsTable)
    .innerJoin(employeesTable, and(eq(leaveRequestsTable.employee_id, employeesTable.id), eq(employeesTable.company_id, companyId)))
    .where(eq(leaveRequestsTable.id, id))
    .then(rows => rows.map(r => r.lr));
  if (!request) { res.status(404).json({ error: "الطلب غير موجود" }); return; }
  if (request.status !== "pending") { res.status(409).json({ error: "لا يمكن رفض طلب غير معلّق" }); return; }

  await db.update(leaveRequestsTable)
    .set({ status: "rejected", rejection_reason: reason ?? "مرفوض", updated_at: new Date() })
    .where(eq(leaveRequestsTable.id, id));
  await db.insert(leaveApprovalsTable).values({
    leave_request_id: id, approver_id: userId ?? 0, status: "rejected", comment: reason ?? null,
  });
  res.json({ ok: true, status: "rejected" });
}));

/* ── Accrual Run ──────────────────────────────────────────────── */
router.post("/leave-accrual/run", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_employees")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const parsedAccrual = accrualRunSchema.safeParse(req.body);
  if (!parsedAccrual.success) { res.status(400).json({ error: firstZodError(parsedAccrual.error) }); return; }
  const companyId = getTenant(req);
  const month = parsedAccrual.data.month ?? new Date().toISOString().substring(0, 7);

  // Get all active employees
  const employees = await db.select().from(employeesTable)
    .where(and(eq(employeesTable.company_id, companyId), eq(employeesTable.employment_status, "active")));

  // Get policies
  const policies = await db.select({
    id: leavePoliciesTable.id, leave_type_id: leavePoliciesTable.leave_type_id,
    entitlement_days_per_year: leavePoliciesTable.entitlement_days_per_year,
    accrual_method: leavePoliciesTable.accrual_method,
  }).from(leavePoliciesTable).where(eq(leavePoliciesTable.company_id, companyId));

  let processed = 0;
  for (const emp of employees) {
    for (const policy of policies) {
      const monthlyAccrual = policy.entitlement_days_per_year / 12;

      // Upsert leave balance
      const [existing] = await db.select().from(employeeLeaveBalancesTable)
        .where(and(eq(employeeLeaveBalancesTable.employee_id, emp.id), eq(employeeLeaveBalancesTable.leave_type_id, policy.leave_type_id)));

      if (existing) {
        await db.update(employeeLeaveBalancesTable)
          .set({ accrued_days: String(Number(existing.accrued_days) + monthlyAccrual), balance_days: String(Number(existing.balance_days) + monthlyAccrual), updated_at: new Date(), as_of_date: new Date().toISOString().split("T")[0] })
          .where(eq(employeeLeaveBalancesTable.id, existing.id));
      } else {
        await db.insert(employeeLeaveBalancesTable).values({
          employee_id: emp.id, leave_type_id: policy.leave_type_id,
          accrued_days: String(monthlyAccrual), used_days: "0",
          balance_days: String(monthlyAccrual), carryover_days: "0",
          as_of_date: new Date().toISOString().split("T")[0],
        });
      }

      // Log accrual
      await db.insert(leaveAccrualHistoryTable).values({
        employee_id: emp.id, leave_type_id: policy.leave_type_id,
        accrued_days: String(monthlyAccrual), month,
      });
      processed++;
    }
  }

  res.json({ ok: true, processed, month });
}));

/* ── Blackout Dates ───────────────────────────────────────────── */
router.get("/leave-blackout-dates", wrap(async (req, res) => {
  const companyId = getTenant(req);
  const rows = await db.select().from(leaveBlackoutDatesTable)
    .where(eq(leaveBlackoutDatesTable.company_id, companyId))
    .orderBy(leaveBlackoutDatesTable.start_date);
  res.json(rows.map(r => ({ ...r, created_at: fmt(r.created_at) })));
}));

router.post("/leave-blackout-dates", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_employees")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const parsedBlackout = createBlackoutSchema.safeParse(req.body);
  if (!parsedBlackout.success) { res.status(400).json({ error: firstZodError(parsedBlackout.error) }); return; }
  const companyId = getTenant(req);
  const { start_date, end_date, reason_ar, reason_en } = parsedBlackout.data;
  const [row] = await db.insert(leaveBlackoutDatesTable).values({
    company_id: companyId, start_date, end_date, reason_ar: reason_ar ?? null, reason_en: reason_en ?? null,
  }).returning();
  res.status(201).json({ ...row, created_at: fmt(row.created_at) });
}));

router.delete("/leave-blackout-dates/:id", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_employees")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = getTenant(req);
  const id = parseInt(String(req.params["id"]), 10);
  await db.delete(leaveBlackoutDatesTable).where(and(eq(leaveBlackoutDatesTable.id, id), eq(leaveBlackoutDatesTable.company_id, companyId)));
  res.json({ ok: true });
}));

export default router;
