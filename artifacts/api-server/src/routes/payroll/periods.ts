/**
 * Payroll periods — CRUD for payroll period management.
 */
import { Router, type IRouter } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  db,
  payrollPeriodsTable, payrollRecordsTable,
  employeesTable,
} from "@workspace/db";
import { wrap } from "../../lib/async-handler";
import { hasPermission } from "../../lib/permissions";
import { getTenant } from "../../middleware/auth";

const router: IRouter = Router();

function fmt(v: Date | null | undefined) { return v instanceof Date ? v.toISOString() : (v ?? null); }

/* ═══════════════════════════════════════════════════════════════════
   PAYROLL PERIODS
══════════════════════════════════════════════════════════════════════ */

router.get("/payroll/periods", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_payroll")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = getTenant(req);
  const rows = await db.select().from(payrollPeriodsTable)
    .where(eq(payrollPeriodsTable.company_id, companyId))
    .orderBy(desc(payrollPeriodsTable.start_date));
  res.json(rows.map(r => ({ ...r, created_at: fmt(r.created_at), updated_at: fmt(r.updated_at), processed_at: fmt(r.processed_at) })));
}));

router.post("/payroll/periods", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_payroll")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = getTenant(req);
  const userId = req.user?.id ?? null;
  const { z } = await import("zod");
  const payrollPeriodSchema = z.object({
    name:       z.string().min(1, "اسم الفترة مطلوب").max(200),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "صيغة تاريخ البداية غير صحيحة"),
    end_date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "صيغة تاريخ النهاية غير صحيحة"),
    notes:      z.string().max(1000).nullable().optional(),
  }).refine(d => new Date(d.start_date) < new Date(d.end_date), {
    message: "تاريخ البداية يجب أن يكون قبل تاريخ النهاية",
    path: ["end_date"],
  });
  const parsed = payrollPeriodSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0]?.message ?? "بيانات الفترة غير صحيحة", details: parsed.error.errors }); return; }
  const { name, start_date, end_date, notes } = parsed.data;
  const overlap = await db.select({ id: payrollPeriodsTable.id }).from(payrollPeriodsTable)
    .where(and(eq(payrollPeriodsTable.company_id, companyId), sql`status NOT IN ('cancelled','paid')`,
      sql`(start_date <= ${end_date} AND end_date >= ${start_date})`));
  if (overlap.length > 0) { res.status(409).json({ error: "توجد فترة مرتبات نشطة تتداخل مع هذه الفترة" }); return; }
  const [row] = await db.insert(payrollPeriodsTable).values({ company_id: companyId, name: name.trim(), start_date, end_date, notes: notes ?? null, processed_by: userId }).returning();
  res.status(201).json({ ...row, created_at: fmt(row.created_at), updated_at: fmt(row.updated_at), processed_at: fmt(row.processed_at) });
}));

router.get("/payroll/periods/:id", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_payroll")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = getTenant(req);
  const id = parseInt(String(req.params["id"]), 10);
  const [period] = await db.select().from(payrollPeriodsTable)
    .where(and(eq(payrollPeriodsTable.id, id), eq(payrollPeriodsTable.company_id, companyId)));
  if (!period) { res.status(404).json({ error: "الفترة غير موجودة" }); return; }
  const records = await db.select({
    id: payrollRecordsTable.id, employee_id: payrollRecordsTable.employee_id,
    gross_salary: payrollRecordsTable.gross_salary, net_salary: payrollRecordsTable.net_salary,
    status: payrollRecordsTable.status, currency: payrollRecordsTable.currency,
    first_name_ar: employeesTable.first_name_ar, last_name_ar: employeesTable.last_name_ar,
    employee_code: employeesTable.employee_code,
  })
    .from(payrollRecordsTable)
    .leftJoin(employeesTable, eq(payrollRecordsTable.employee_id, employeesTable.id))
    .where(eq(payrollRecordsTable.payroll_period_id, id));
  res.json({
    ...period, created_at: fmt(period.created_at), updated_at: fmt(period.updated_at), processed_at: fmt(period.processed_at),
    records: records.map(r => ({ ...r, gross_salary: Number(r.gross_salary), net_salary: Number(r.net_salary) })),
  });
}));

router.put("/payroll/periods/:id", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_payroll")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = getTenant(req);
  const id = parseInt(String(req.params["id"]), 10);
  const { name, notes } = req.body as Record<string, string>;
  const [row] = await db.update(payrollPeriodsTable)
    .set({ name: name?.trim() ?? "", notes: notes ?? null, updated_at: new Date() })
    .where(and(eq(payrollPeriodsTable.id, id), eq(payrollPeriodsTable.company_id, companyId), eq(payrollPeriodsTable.status, "draft")))
    .returning();
  if (!row) { res.status(404).json({ error: "الفترة غير موجودة أو لا يمكن تعديلها" }); return; }
  res.json({ ...row, created_at: fmt(row.created_at), updated_at: fmt(row.updated_at), processed_at: fmt(row.processed_at) });
}));

export default router;
