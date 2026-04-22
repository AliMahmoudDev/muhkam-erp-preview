/**
 * /api/salary-advances
 * Salary advance request, approval, repayment, and ledger system.
 */
import { Router, type IRouter } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  db,
  salaryAdvancesTable, salaryAdvanceDeductionsTable,
  salaryAdvanceSettingsTable, salaryAdvanceHistoryTable, salaryAdvanceLedgerTable,
  employeesTable,
} from "@workspace/db";
import { wrap } from "../lib/async-handler";
import { hasPermission } from "../lib/permissions";
import { selfEmployeeId, isSelfServiceUser } from "../lib/employee-self";
import { writeAuditLog } from "../lib/audit-log";
import { notifyEmployee, notifyManagers } from "../lib/notify";

const router: IRouter = Router();
function fmt(v: Date | null | undefined) { return v instanceof Date ? v.toISOString() : (v ?? null); }
function n(v: unknown) { return v != null ? Number(v) : 0; }

async function logHistory(advanceId: number, oldStatus: string | null, newStatus: string, changedBy: number | null, comment?: string) {
  await db.insert(salaryAdvanceHistoryTable).values({
    salary_advance_id: advanceId, old_status: oldStatus, new_status: newStatus,
    changed_by: changedBy, comment: comment ?? null,
  });
}

/** يجلب السلفة مع التحقق من ملكية الشركة عبر علاقة الموظف. يرجع null لو غير مملوكة. */
async function getAdvanceForCompany(advanceId: number, companyId: number) {
  const [row] = await db.select({ adv: salaryAdvancesTable })
    .from(salaryAdvancesTable)
    .innerJoin(employeesTable, eq(salaryAdvancesTable.employee_id, employeesTable.id))
    .where(and(eq(salaryAdvancesTable.id, advanceId), eq(employeesTable.company_id, companyId)));
  return row?.adv ?? null;
}

/* ═══════════════════════════════════════════════════════════════════
   SETTINGS
══════════════════════════════════════════════════════════════════════ */

router.get("/salary-advances/settings", wrap(async (req, res) => {
  const companyId = req.user!.company_id!;
  const [settings] = await db.select().from(salaryAdvanceSettingsTable)
    .where(eq(salaryAdvanceSettingsTable.company_id, companyId));
  if (!settings) {
    res.json({ company_id: companyId, max_advance_percentage: 50, max_concurrent_advances: 2, min_salary_for_advance: 3000, repayment_tenure_months: 1, requires_approval: true });
    return;
  }
  res.json({ ...settings, max_advance_percentage: n(settings.max_advance_percentage), min_salary_for_advance: n(settings.min_salary_for_advance), created_at: fmt(settings.created_at), updated_at: fmt(settings.updated_at) });
}));

router.put("/salary-advances/settings", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_payroll")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = req.user!.company_id!;
  const { max_advance_percentage, max_concurrent_advances, min_salary_for_advance, repayment_tenure_months, requires_approval } = req.body as Record<string, unknown>;
  const [existing] = await db.select().from(salaryAdvanceSettingsTable).where(eq(salaryAdvanceSettingsTable.company_id, companyId));
  if (existing) {
    const [row] = await db.update(salaryAdvanceSettingsTable)
      .set({ max_advance_percentage: String(Number(max_advance_percentage) || 50), max_concurrent_advances: Number(max_concurrent_advances) || 2, min_salary_for_advance: String(Number(min_salary_for_advance) || 3000), repayment_tenure_months: Number(repayment_tenure_months) || 1, requires_approval: Boolean(requires_approval !== false), updated_at: new Date() })
      .where(eq(salaryAdvanceSettingsTable.company_id, companyId)).returning();
    res.json({ ...row, max_advance_percentage: n(row.max_advance_percentage), min_salary_for_advance: n(row.min_salary_for_advance), created_at: fmt(row.created_at), updated_at: fmt(row.updated_at) });
  } else {
    const [row] = await db.insert(salaryAdvanceSettingsTable).values({
      company_id: companyId, max_advance_percentage: String(Number(max_advance_percentage) || 50), max_concurrent_advances: Number(max_concurrent_advances) || 2, min_salary_for_advance: String(Number(min_salary_for_advance) || 3000), repayment_tenure_months: Number(repayment_tenure_months) || 1, requires_approval: Boolean(requires_approval !== false),
    }).returning();
    res.json({ ...row, max_advance_percentage: n(row.max_advance_percentage), min_salary_for_advance: n(row.min_salary_for_advance), created_at: fmt(row.created_at), updated_at: fmt(row.updated_at) });
  }
}));

/* ═══════════════════════════════════════════════════════════════════
   SALARY ADVANCES
══════════════════════════════════════════════════════════════════════ */

router.get("/salary-advances", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_employees")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = req.user!.company_id!;
  const queryEmpId = req.query["employee_id"] ? parseInt(String(req.query["employee_id"]), 10) : null;
  const status = String(req.query["status"] ?? "");
  // Self-service: force-filter to the caller's own employee record
  const selfId = selfEmployeeId(req);
  const empId = selfId !== null ? selfId : queryEmpId;

  const conditions = [eq(employeesTable.company_id, companyId)];
  if (empId)  conditions.push(eq(salaryAdvancesTable.employee_id, empId));
  if (status) conditions.push(eq(salaryAdvancesTable.status, status));

  const rows = await db.select({
    id: salaryAdvancesTable.id, employee_id: salaryAdvancesTable.employee_id,
    requested_date: salaryAdvancesTable.requested_date, requested_amount: salaryAdvancesTable.requested_amount,
    approved_amount: salaryAdvancesTable.approved_amount, advance_type: salaryAdvancesTable.advance_type,
    reason: salaryAdvancesTable.reason, status: salaryAdvancesTable.status,
    deduct_from: salaryAdvancesTable.deduct_from,
    safe_id: salaryAdvancesTable.safe_id,
    remaining_balance: salaryAdvancesTable.remaining_balance, currency: salaryAdvancesTable.currency,
    approved_at: salaryAdvancesTable.approved_at, created_at: salaryAdvancesTable.created_at,
    first_name_ar: employeesTable.first_name_ar, last_name_ar: employeesTable.last_name_ar,
    employee_code: employeesTable.employee_code,
  })
    .from(salaryAdvancesTable)
    .leftJoin(employeesTable, eq(salaryAdvancesTable.employee_id, employeesTable.id))
    .where(and(...conditions))
    .orderBy(desc(salaryAdvancesTable.created_at))
    .limit(100);

  res.json(rows.map(r => ({ ...r, requested_amount: n(r.requested_amount), approved_amount: r.approved_amount != null ? n(r.approved_amount) : null, remaining_balance: n(r.remaining_balance), approved_at: fmt(r.approved_at), created_at: fmt(r.created_at) })));
}));

router.post("/salary-advances", wrap(async (req, res) => {
  const companyId = req.user!.company_id!;
  const userId    = req.user?.id ?? null;
  const isSelf    = isSelfServiceUser(req);
  const selfId    = selfEmployeeId(req);
  const body      = req.body as Record<string, unknown>;
  // Self-service: force employee_id to caller's own, ignore safe_id, force pending.
  let { employee_id, safe_id } = body;
  const { requested_amount, advance_type, reason, deduct_from } = body;
  if (isSelf) {
    if (selfId == null) { res.status(403).json({ error: "حساب الموظف غير مرتبط بسجل" }); return; }
    employee_id = selfId;
    safe_id = null;
  }
  if (!employee_id || !requested_amount || !advance_type) { res.status(400).json({ error: "الموظف والمبلغ ونوع السلفة مطلوبون" }); return; }
  const df = String(deduct_from ?? "fixed");
  if (!["fixed", "commission", "both"].includes(df)) { res.status(400).json({ error: "قيمة الخصم غير صحيحة" }); return; }

  // Verify employee and minimum salary
  const [emp] = await db.select().from(employeesTable)
    .where(and(eq(employeesTable.id, Number(employee_id)), eq(employeesTable.company_id, companyId)));
  if (!emp) { res.status(404).json({ error: "الموظف غير موجود" }); return; }

  const [settings] = await db.select().from(salaryAdvanceSettingsTable).where(eq(salaryAdvanceSettingsTable.company_id, companyId));
  const maxPct     = n(settings?.max_advance_percentage ?? 50);
  const minSalary  = n(settings?.min_salary_for_advance ?? 3000);
  const maxConcurrent = settings?.max_concurrent_advances ?? 2;
  const empSalary  = Number(emp.salary ?? 0);
  const reqAmt     = Number(requested_amount);

  // Commission-only employees (no fixed salary) bypass the minimum salary check
  const isCommissionOnly = empSalary === 0 && Number(emp.commission_rate ?? 0) > 0;
  if (!isCommissionOnly && empSalary < minSalary) { res.status(422).json({ error: `الراتب أقل من الحد الأدنى المطلوب للسلفة (${minSalary} ${emp.currency})` }); return; }
  if (!isCommissionOnly) {
    const maxAllowed = empSalary * maxPct / 100;
    if (reqAmt > maxAllowed) { res.status(400).json({ error: `المبلغ المطلوب يتجاوز الحد الأقصى (${maxAllowed.toFixed(2)} ${emp.currency})` }); return; }
  }

  // Check concurrent advances
  const activeAdvances = await db.select({ count: sql<number>`COUNT(*)::int` }).from(salaryAdvancesTable)
    .where(and(eq(salaryAdvancesTable.employee_id, Number(employee_id)), sql`status IN ('pending','approved','active')`));
  if ((activeAdvances[0]?.count ?? 0) >= maxConcurrent) { res.status(409).json({ error: `وصلت إلى الحد الأقصى للسلف المتزامنة (${maxConcurrent})` }); return; }

  // Self-service requests always require approval, regardless of company setting.
  const requiresApproval = isSelf ? true : (settings?.requires_approval !== false);
  const [advance] = await db.insert(salaryAdvancesTable).values({
    company_id: companyId,
    employee_id: Number(employee_id), requested_date: new Date().toISOString().split("T")[0],
    requested_amount: String(reqAmt), advance_type: String(advance_type),
    reason: reason ? String(reason) : null, deduct_from: df, status: requiresApproval ? "pending" : "approved",
    safe_id: safe_id != null && safe_id !== "" ? Number(safe_id) : null,
    currency: emp.currency ?? "EGP",
    approved_amount: !requiresApproval ? String(reqAmt) : null,
    approved_at: !requiresApproval ? new Date() : null,
    remaining_balance: !requiresApproval ? String(reqAmt) : "0",
    approver_id: !requiresApproval ? userId : null,
  }).returning();

  await logHistory(advance.id, null, advance.status, userId, isSelf ? "طلب سلفة من الموظف (خدمة ذاتية)" : "طلب سلفة جديدة");

  if (!requiresApproval) {
    await db.insert(salaryAdvanceLedgerTable).values({
      employee_id: Number(employee_id), advance_id: advance.id,
      ledger_type: "advance_granted", amount: String(reqAmt), balance: String(reqAmt),
      ledger_date: new Date().toISOString().split("T")[0],
    });
  }

  // Notify managers about a new pending request (self-service or otherwise).
  if (advance.status === "pending") {
    const empName = `${emp.first_name_ar ?? ""} ${emp.last_name_ar ?? ""}`.trim() || `#${emp.id}`;
    await notifyManagers(companyId, "can_manage_payroll", {
      type: "advance_pending",
      title: "طلب سلفة جديد بانتظار الاعتماد",
      message: `طلب ${empName} سلفة بمبلغ ${reqAmt.toFixed(2)} ${emp.currency ?? "EGP"}`,
      link: "/employees",
      reference_id: advance.id,
    });
  }

  res.status(201).json({ ...advance, requested_amount: n(advance.requested_amount), remaining_balance: n(advance.remaining_balance), created_at: fmt(advance.created_at), updated_at: fmt(advance.updated_at), approved_at: fmt(advance.approved_at) });
}));

/* ── Pending Approvals (MUST be before /:id) ──────────────────── */
router.get("/salary-advances/pending-approvals", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_payroll")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = req.user!.company_id!;
  const rows = await db.select({
    id: salaryAdvancesTable.id, employee_id: salaryAdvancesTable.employee_id,
    requested_date: salaryAdvancesTable.requested_date, requested_amount: salaryAdvancesTable.requested_amount,
    advance_type: salaryAdvancesTable.advance_type, reason: salaryAdvancesTable.reason,
    currency: salaryAdvancesTable.currency, created_at: salaryAdvancesTable.created_at,
    first_name_ar: employeesTable.first_name_ar, last_name_ar: employeesTable.last_name_ar,
    employee_code: employeesTable.employee_code, salary: employeesTable.salary,
  })
    .from(salaryAdvancesTable)
    .leftJoin(employeesTable, eq(salaryAdvancesTable.employee_id, employeesTable.id))
    .where(and(eq(employeesTable.company_id, companyId), eq(salaryAdvancesTable.status, "pending")))
    .orderBy(desc(salaryAdvancesTable.created_at));
  res.json(rows.map(r => ({ ...r, requested_amount: n(r.requested_amount), salary: n(r.salary), created_at: fmt(r.created_at) })));
}));

/* ── Single Advance ───────────────────────────────────────────── */
router.get("/salary-advances/:id", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_employees")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = req.user!.company_id!;
  const id = parseInt(String(req.params["id"]), 10);
  if (isNaN(id)) { res.status(400).json({ error: "معرف غير صحيح" }); return; }
  const [advance] = await db.select({
    id: salaryAdvancesTable.id, employee_id: salaryAdvancesTable.employee_id,
    requested_date: salaryAdvancesTable.requested_date, requested_amount: salaryAdvancesTable.requested_amount,
    approved_amount: salaryAdvancesTable.approved_amount, advance_type: salaryAdvancesTable.advance_type,
    reason: salaryAdvancesTable.reason, status: salaryAdvancesTable.status,
    deduct_from: salaryAdvancesTable.deduct_from,
    safe_id: salaryAdvancesTable.safe_id,
    rejection_reason: salaryAdvancesTable.rejection_reason, remaining_balance: salaryAdvancesTable.remaining_balance,
    currency: salaryAdvancesTable.currency, created_at: salaryAdvancesTable.created_at, approved_at: salaryAdvancesTable.approved_at,
    first_name_ar: employeesTable.first_name_ar, last_name_ar: employeesTable.last_name_ar, employee_code: employeesTable.employee_code,
  })
    .from(salaryAdvancesTable)
    .innerJoin(employeesTable, eq(salaryAdvancesTable.employee_id, employeesTable.id))
    .where(and(eq(salaryAdvancesTable.id, id), eq(employeesTable.company_id, companyId)));
  if (!advance) { res.status(404).json({ error: "السلفة غير موجودة" }); return; }
  res.json({ ...advance, requested_amount: n(advance.requested_amount), approved_amount: advance.approved_amount != null ? n(advance.approved_amount) : null, remaining_balance: n(advance.remaining_balance), created_at: fmt(advance.created_at), approved_at: fmt(advance.approved_at) });
}));

/* ── Approve ──────────────────────────────────────────────────── */
router.post("/salary-advances/:id/approve", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_payroll")) { res.status(403).json({ error: "غير مصرح بالاعتماد" }); return; }
  const companyId = req.user!.company_id!;
  const userId = req.user?.id ?? null;
  const id = parseInt(String(req.params["id"]), 10);
  const { approved_amount } = req.body as { approved_amount?: number };

  const advance = await getAdvanceForCompany(id, companyId);
  if (!advance) { res.status(404).json({ error: "السلفة غير موجودة" }); return; }
  if (advance.status !== "pending") { res.status(409).json({ error: "السلفة غير معلّقة" }); return; }

  const amount = approved_amount ?? Number(advance.requested_amount);
  const [row] = await db.update(salaryAdvancesTable)
    .set({ status: "active", approved_amount: String(amount), remaining_balance: String(amount), approver_id: userId, approved_at: new Date(), updated_at: new Date() })
    .where(eq(salaryAdvancesTable.id, id)).returning();

  await logHistory(id, "pending", "active", userId, "اعتماد السلفة");

  // Ledger entry
  await db.insert(salaryAdvanceLedgerTable).values({
    employee_id: advance.employee_id, advance_id: id,
    ledger_type: "advance_granted", amount: String(amount), balance: String(amount),
    ledger_date: new Date().toISOString().split("T")[0],
  });

  await writeAuditLog({ action: "update", record_type: "salary_advance", record_id: id, new_value: { status: "active", amount }, user: { id: userId ?? undefined, username: req.user?.username } });

  // Notify the employee that their advance was approved.
  await notifyEmployee(companyId, advance.employee_id, {
    type: "advance_approved",
    title: "تم اعتماد طلب السلفة",
    message: `تم اعتماد سلفتك بمبلغ ${Number(amount).toFixed(2)} ${advance.currency ?? "EGP"}`,
    link: "/employees",
    reference_id: id,
  });

  res.json({ ok: true, approved_amount: amount, remaining_balance: n(row.remaining_balance) });
}));

/* ── Reject ───────────────────────────────────────────────────── */
router.post("/salary-advances/:id/reject", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_payroll")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = req.user!.company_id!;
  const userId = req.user?.id ?? null;
  const id = parseInt(String(req.params["id"]), 10);
  const { reason } = req.body as { reason?: string };
  const advance = await getAdvanceForCompany(id, companyId);
  if (!advance) { res.status(404).json({ error: "السلفة غير موجودة" }); return; }
  if (advance.status !== "pending") { res.status(409).json({ error: "لا يمكن رفض سلفة غير معلّقة" }); return; }
  await db.update(salaryAdvancesTable).set({ status: "rejected", rejection_reason: reason ?? "مرفوض", updated_at: new Date() }).where(eq(salaryAdvancesTable.id, id));
  await logHistory(id, "pending", "rejected", userId, reason);

  // Notify the employee about the rejection.
  await notifyEmployee(companyId, advance.employee_id, {
    type: "advance_rejected",
    title: "تم رفض طلب السلفة",
    message: reason ? `سبب الرفض: ${reason}` : "تم رفض طلب السلفة الخاص بك",
    link: "/employees",
    reference_id: id,
  });

  res.json({ ok: true });
}));

/* ── Cancel ───────────────────────────────────────────────────── */
router.post("/salary-advances/:id/cancel", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_payroll")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = req.user!.company_id!;
  const userId = req.user?.id ?? null;
  const id = parseInt(String(req.params["id"]), 10);
  const advance = await getAdvanceForCompany(id, companyId);
  if (!advance) { res.status(404).json({ error: "السلفة غير موجودة" }); return; }
  await db.update(salaryAdvancesTable).set({ status: "cancelled", updated_at: new Date() }).where(eq(salaryAdvancesTable.id, id));
  await logHistory(id, advance.status, "cancelled", userId, "إلغاء من المدير");
  res.json({ ok: true });
}));

/* ── Deductions ───────────────────────────────────────────────── */
router.get("/salary-advances/:id/deductions", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_employees")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = req.user!.company_id!;
  const id = parseInt(String(req.params["id"]), 10);
  const advance = await getAdvanceForCompany(id, companyId);
  if (!advance) { res.status(404).json({ error: "السلفة غير موجودة" }); return; }
  const rows = await db.select().from(salaryAdvanceDeductionsTable)
    .where(eq(salaryAdvanceDeductionsTable.salary_advance_id, id))
    .orderBy(desc(salaryAdvanceDeductionsTable.deduction_date));
  res.json(rows.map(r => ({ ...r, deduction_amount: n(r.deduction_amount), created_at: fmt(r.created_at) })));
}));

/* ── Manual Payment ───────────────────────────────────────────── */
router.post("/salary-advances/:id/manual-payment", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_payroll")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = req.user!.company_id!;
  const userId = req.user?.id ?? null;
  const id = parseInt(String(req.params["id"]), 10);
  const { amount, notes } = req.body as { amount?: number; notes?: string };
  if (!amount || amount <= 0) { res.status(400).json({ error: "مبلغ السداد يجب أن يكون موجباً" }); return; }

  const advance = await getAdvanceForCompany(id, companyId);
  if (!advance) { res.status(404).json({ error: "السلفة غير موجودة" }); return; }

  const result = await db.transaction(async (tx) => {
    // قفل صف السلفة لمنع تسديدين متزامنين يتجاوزان الرصيد
    const [locked] = await tx.execute(sql`
      SELECT id, remaining_balance, status FROM ${salaryAdvancesTable}
      WHERE id = ${id} AND company_id = ${companyId}
      FOR UPDATE
    `).then((r: any) => (r.rows ?? r) as Array<{ id: number; remaining_balance: string; status: string }>);
    if (!locked) return { error: { status: 404, message: "السلفة غير موجودة" } };
    const remaining = n(locked.remaining_balance);
    if (amount > remaining) return { error: { status: 400, message: `المبلغ يتجاوز الرصيد المتبقي (${remaining})` } };

    const newBalance = remaining - amount;
    const newStatus  = newBalance <= 0 ? "completed" : "active";

    // تحديث ذرّي مع شرط أن الحالة لم تتغير ومن الرصيد كافٍ
    const updated = await tx.update(salaryAdvancesTable)
      .set({ remaining_balance: String(newBalance), status: newStatus, updated_at: new Date() })
      .where(and(
        eq(salaryAdvancesTable.id, id),
        eq(salaryAdvancesTable.company_id, companyId),
        sql`${salaryAdvancesTable.remaining_balance} >= ${String(amount)}`,
      ))
      .returning();
    if (!updated[0]) return { error: { status: 409, message: "تعذّر السداد — الحالة تغيّرت، حاول مجدداً" } };

    await tx.insert(salaryAdvanceDeductionsTable).values({
      salary_advance_id: id, deduction_amount: String(amount),
      deduction_date: new Date().toISOString().split("T")[0], notes: notes ?? "دفعة يدوية",
    });
    await tx.insert(salaryAdvanceLedgerTable).values({
      employee_id: advance.employee_id, advance_id: id,
      ledger_type: "manual_payment", amount: String(amount), balance: String(newBalance),
      ledger_date: new Date().toISOString().split("T")[0], notes: notes ?? null,
    });
    return { ok: true, newBalance, newStatus };
  });

  if ("error" in result && result.error) {
    res.status(result.error.status).json({ error: result.error.message });
    return;
  }
  if (result.newStatus === "completed") await logHistory(id, "active", "completed", userId, "تم السداد الكامل");
  res.json({ ok: true, remaining_balance: result.newBalance, status: result.newStatus });
}));

/** التحقق من ملكية الموظف للشركة. يرجع true لو موجود ضمن نفس الشركة. */
async function employeeBelongsToCompany(empId: number, companyId: number) {
  const [row] = await db.select({ id: employeesTable.id }).from(employeesTable)
    .where(and(eq(employeesTable.id, empId), eq(employeesTable.company_id, companyId)));
  return !!row;
}

/* ── Outstanding Balance ──────────────────────────────────────── */
router.get("/salary-advances/:employeeId/balance", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_employees")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = req.user!.company_id!;
  const empId = parseInt(String(req.params["employeeId"]), 10);
  if (!(await employeeBelongsToCompany(empId, companyId))) {
    res.status(404).json({ error: "الموظف غير موجود" }); return;
  }
  const advances = await db.select({ remaining_balance: salaryAdvancesTable.remaining_balance, status: salaryAdvancesTable.status, currency: salaryAdvancesTable.currency })
    .from(salaryAdvancesTable)
    .where(and(
      eq(salaryAdvancesTable.employee_id, empId),
      eq(salaryAdvancesTable.company_id, companyId),
      sql`${salaryAdvancesTable.status} IN ('active','approved')`,
    ));
  const total = advances.reduce((s, a) => s + n(a.remaining_balance), 0);
  res.json({ employee_id: empId, outstanding_balance: total, currency: advances[0]?.currency ?? "EGP", advances_count: advances.length });
}));

/* ── Ledger ───────────────────────────────────────────────────── */
router.get("/salary-advances/:employeeId/ledger", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_employees")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = req.user!.company_id!;
  const empId = parseInt(String(req.params["employeeId"]), 10);
  if (!(await employeeBelongsToCompany(empId, companyId))) {
    res.status(404).json({ error: "الموظف غير موجود" }); return;
  }
  // الحماية مسبقة via employeeBelongsToCompany — نضيف فلترة الـ advance_id عبر JOIN دفاعياً
  const rows = await db
    .select({
      id: salaryAdvanceLedgerTable.id,
      employee_id: salaryAdvanceLedgerTable.employee_id,
      advance_id: salaryAdvanceLedgerTable.advance_id,
      ledger_type: salaryAdvanceLedgerTable.ledger_type,
      amount: salaryAdvanceLedgerTable.amount,
      balance: salaryAdvanceLedgerTable.balance,
      ledger_date: salaryAdvanceLedgerTable.ledger_date,
      notes: salaryAdvanceLedgerTable.notes,
      created_at: salaryAdvanceLedgerTable.created_at,
    })
    .from(salaryAdvanceLedgerTable)
    .innerJoin(
      salaryAdvancesTable,
      and(
        eq(salaryAdvancesTable.id, salaryAdvanceLedgerTable.advance_id),
        eq(salaryAdvancesTable.company_id, companyId),
      ),
    )
    .where(eq(salaryAdvanceLedgerTable.employee_id, empId))
    .orderBy(desc(salaryAdvanceLedgerTable.ledger_date));
  res.json(rows.map(r => ({ ...r, amount: n(r.amount), balance: n(r.balance), created_at: fmt(r.created_at) })));
}));

export default router;
