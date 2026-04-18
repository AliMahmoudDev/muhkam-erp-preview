/**
 * /api/incentive-schemes, /api/incentive-rules, /api/daily-accrual
 * Accrual-based incentive system with slab/tiered calculation and payroll integration.
 */
import { Router, type IRouter, type Response } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  db,
  incentiveSchemesTable, incentiveRulesTable, incentiveSlabsTable,
  employeeIncentiveAssignmentsTable, dailyIncentiveAccrualTable,
  monthlyIncentiveSummaryTable, incentiveMetricsTable,
  employeesTable,
} from "@workspace/db";
import { wrap } from "../lib/async-handler";
import { hasPermission } from "../lib/permissions";

const router: IRouter = Router();
function fmt(v: Date | null | undefined) { return v instanceof Date ? v.toISOString() : (v ?? null); }
function n(v: unknown) { return v != null ? Number(v) : 0; }

/* ── Tenant ownership helpers ────────────────────────────────────── */

async function assertEmployeeOwnership(empId: number, companyId: number, res: Response): Promise<boolean> {
  const [emp] = await db.select({ id: employeesTable.id })
    .from(employeesTable)
    .where(and(eq(employeesTable.id, empId), eq(employeesTable.company_id, companyId)));
  if (!emp) { res.status(404).json({ error: "الموظف غير موجود أو لا ينتمي لهذه الشركة" }); return false; }
  return true;
}

async function assertSchemeOwnership(schemeId: number, companyId: number, res: Response): Promise<boolean> {
  const [scheme] = await db.select({ id: incentiveSchemesTable.id })
    .from(incentiveSchemesTable)
    .where(and(eq(incentiveSchemesTable.id, schemeId), eq(incentiveSchemesTable.company_id, companyId)));
  if (!scheme) { res.status(404).json({ error: "مخطط الحوافز غير موجود" }); return false; }
  return true;
}

async function assertRuleOwnership(ruleId: number, companyId: number, res: Response): Promise<boolean> {
  const [rule] = await db.select({ id: incentiveRulesTable.id })
    .from(incentiveRulesTable)
    .innerJoin(incentiveSchemesTable, eq(incentiveRulesTable.incentive_scheme_id, incentiveSchemesTable.id))
    .where(and(eq(incentiveRulesTable.id, ruleId), eq(incentiveSchemesTable.company_id, companyId)));
  if (!rule) { res.status(404).json({ error: "قاعدة الحافز غير موجودة" }); return false; }
  return true;
}

/* ═══════════════════════════════════════════════════════════════════
   INCENTIVE SCHEMES
══════════════════════════════════════════════════════════════════════ */

router.get("/incentive-schemes", wrap(async (req, res) => {
  const companyId = req.user!.company_id!;
  const rows = await db.select().from(incentiveSchemesTable)
    .where(eq(incentiveSchemesTable.company_id, companyId))
    .orderBy(incentiveSchemesTable.name_ar);
  res.json(rows.map(r => ({ ...r, created_at: fmt(r.created_at), updated_at: fmt(r.updated_at) })));
}));

router.post("/incentive-schemes", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_payroll")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = req.user!.company_id!;
  const { name_ar, name_en, description } = req.body as Record<string, string>;
  if (!name_ar?.trim()) { res.status(400).json({ error: "اسم مخطط الحوافز مطلوب" }); return; }
  const [row] = await db.insert(incentiveSchemesTable).values({
    company_id: companyId, name_ar: name_ar.trim(), name_en: name_en?.trim() ?? name_ar.trim(),
    description: description ?? null,
  }).returning();
  res.status(201).json({ ...row, created_at: fmt(row.created_at), updated_at: fmt(row.updated_at) });
}));

router.put("/incentive-schemes/:id", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_payroll")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = req.user!.company_id!;
  const id = parseInt(String(req.params["id"]), 10);
  const { name_ar, name_en, description, status } = req.body as Record<string, string>;
  const [row] = await db.update(incentiveSchemesTable)
    .set({ name_ar: name_ar?.trim() ?? "", name_en: name_en?.trim() ?? name_ar?.trim() ?? "", description: description ?? null, status: status ?? "active", updated_at: new Date() })
    .where(and(eq(incentiveSchemesTable.id, id), eq(incentiveSchemesTable.company_id, companyId)))
    .returning();
  if (!row) { res.status(404).json({ error: "المخطط غير موجود" }); return; }
  res.json({ ...row, created_at: fmt(row.created_at), updated_at: fmt(row.updated_at) });
}));

/* ─ Incentive Rules ───────────────────────────────────────────── */
router.get("/incentive-rules/:schemeId", wrap(async (req, res) => {
  const companyId = req.user!.company_id!;
  const schemeId = parseInt(String(req.params["schemeId"]), 10);
  if (!await assertSchemeOwnership(schemeId, companyId, res)) return;
  const rows = await db.select().from(incentiveRulesTable)
    .where(eq(incentiveRulesTable.incentive_scheme_id, schemeId));
  const slabs = await db.select().from(incentiveSlabsTable)
    .where(sql`incentive_rule_id IN (SELECT id FROM incentive_rules WHERE incentive_scheme_id = ${schemeId})`);
  res.json(rows.map(r => ({
    ...r, target_value: n(r.target_value), incentive_amount: n(r.incentive_amount),
    created_at: fmt(r.created_at),
    slabs: slabs.filter(s => s.incentive_rule_id === r.id).sort((a, b) => a.slab_number - b.slab_number)
      .map(s => ({ ...s, from_percentage: n(s.from_percentage), to_percentage: n(s.to_percentage), incentive_value: n(s.incentive_value), created_at: fmt(s.created_at) })),
  })));
}));

router.post("/incentive-rules", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_payroll")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = req.user!.company_id!;
  const { incentive_scheme_id, metric_type, target_value, incentive_amount, incentive_type, calculation_method, currency } = req.body as Record<string, unknown>;
  if (!incentive_scheme_id || !metric_type || !target_value) { res.status(400).json({ error: "بيانات القاعدة غير مكتملة" }); return; }
  if (!await assertSchemeOwnership(Number(incentive_scheme_id), companyId, res)) return;
  const [row] = await db.insert(incentiveRulesTable).values({
    incentive_scheme_id: Number(incentive_scheme_id), metric_type: String(metric_type),
    target_value: String(Number(target_value)), incentive_amount: incentive_amount != null ? String(Number(incentive_amount)) : null,
    incentive_type: String(incentive_type ?? "fixed"), calculation_method: String(calculation_method ?? "achievement"),
    currency: String(currency ?? "EGP"),
  }).returning();
  res.status(201).json({ ...row, target_value: n(row.target_value), incentive_amount: n(row.incentive_amount), created_at: fmt(row.created_at) });
}));

router.put("/incentive-rules/:id", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_payroll")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = req.user!.company_id!;
  const id = parseInt(String(req.params["id"]), 10);
  if (!await assertRuleOwnership(id, companyId, res)) return;
  const { metric_type, target_value, incentive_amount, incentive_type, calculation_method, is_active } = req.body as Record<string, unknown>;
  const [row] = await db.update(incentiveRulesTable)
    .set({ metric_type: String(metric_type ?? ""), target_value: String(Number(target_value)), incentive_amount: incentive_amount != null ? String(Number(incentive_amount)) : null, incentive_type: String(incentive_type ?? "fixed"), calculation_method: String(calculation_method ?? "achievement"), is_active: Boolean(is_active !== false) })
    .where(eq(incentiveRulesTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "القاعدة غير موجودة" }); return; }
  res.json({ ...row, target_value: n(row.target_value), incentive_amount: n(row.incentive_amount), created_at: fmt(row.created_at) });
}));

/* ─ Incentive Slabs ───────────────────────────────────────────── */
router.post("/incentive-slabs", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_payroll")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = req.user!.company_id!;
  const { incentive_rule_id, slab_number, from_percentage, to_percentage, incentive_value } = req.body as Record<string, unknown>;
  if (!incentive_rule_id || from_percentage == null || incentive_value == null) { res.status(400).json({ error: "بيانات الشريحة غير مكتملة" }); return; }
  if (!await assertRuleOwnership(Number(incentive_rule_id), companyId, res)) return;
  const [row] = await db.insert(incentiveSlabsTable).values({
    incentive_rule_id: Number(incentive_rule_id), slab_number: Number(slab_number) || 1,
    from_percentage: String(Number(from_percentage)), to_percentage: to_percentage != null ? String(Number(to_percentage)) : null,
    incentive_value: String(Number(incentive_value)),
  }).returning();
  res.status(201).json({ ...row, from_percentage: n(row.from_percentage), to_percentage: n(row.to_percentage), incentive_value: n(row.incentive_value), created_at: fmt(row.created_at) });
}));

router.put("/incentive-slabs/:id", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_payroll")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = req.user!.company_id!;
  const id = parseInt(String(req.params["id"]), 10);
  const [slab] = await db.select({ rule_id: incentiveSlabsTable.incentive_rule_id })
    .from(incentiveSlabsTable).where(eq(incentiveSlabsTable.id, id));
  if (!slab) { res.status(404).json({ error: "الشريحة غير موجودة" }); return; }
  if (!await assertRuleOwnership(slab.rule_id, companyId, res)) return;
  const { slab_number, from_percentage, to_percentage, incentive_value } = req.body as Record<string, unknown>;
  const [row] = await db.update(incentiveSlabsTable)
    .set({ slab_number: Number(slab_number) || 1, from_percentage: String(Number(from_percentage)), to_percentage: to_percentage != null ? String(Number(to_percentage)) : null, incentive_value: String(Number(incentive_value)) })
    .where(eq(incentiveSlabsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "الشريحة غير موجودة" }); return; }
  res.json({ ...row, from_percentage: n(row.from_percentage), to_percentage: n(row.to_percentage), incentive_value: n(row.incentive_value) });
}));

router.delete("/incentive-slabs/:id", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_payroll")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = req.user!.company_id!;
  const id = parseInt(String(req.params["id"]), 10);
  const [slab] = await db.select({ rule_id: incentiveSlabsTable.incentive_rule_id })
    .from(incentiveSlabsTable).where(eq(incentiveSlabsTable.id, id));
  if (!slab) { res.status(404).json({ error: "الشريحة غير موجودة" }); return; }
  if (!await assertRuleOwnership(slab.rule_id, companyId, res)) return;
  await db.delete(incentiveSlabsTable).where(eq(incentiveSlabsTable.id, id));
  res.json({ ok: true });
}));

/* ═══════════════════════════════════════════════════════════════════
   EMPLOYEE INCENTIVE ASSIGNMENTS
══════════════════════════════════════════════════════════════════════ */

router.post("/employee-incentive-assignments", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_payroll")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = req.user!.company_id!;
  const { employee_id, incentive_scheme_id, assigned_date, end_date } = req.body as Record<string, unknown>;
  if (!employee_id || !incentive_scheme_id || !assigned_date) { res.status(400).json({ error: "بيانات التعيين غير مكتملة" }); return; }
  if (!await assertEmployeeOwnership(Number(employee_id), companyId, res)) return;
  if (!await assertSchemeOwnership(Number(incentive_scheme_id), companyId, res)) return;
  const [row] = await db.insert(employeeIncentiveAssignmentsTable).values({
    employee_id: Number(employee_id), incentive_scheme_id: Number(incentive_scheme_id),
    assigned_date: String(assigned_date), end_date: end_date ? String(end_date) : null,
  }).returning();
  res.status(201).json({ ...row, created_at: fmt(row.created_at) });
}));

router.get("/employee-incentive-assignments/:employeeId", wrap(async (req, res) => {
  const companyId = req.user!.company_id!;
  const empId = parseInt(String(req.params["employeeId"]), 10);
  if (!await assertEmployeeOwnership(empId, companyId, res)) return;
  const rows = await db.select({
    id: employeeIncentiveAssignmentsTable.id,
    employee_id: employeeIncentiveAssignmentsTable.employee_id,
    incentive_scheme_id: employeeIncentiveAssignmentsTable.incentive_scheme_id,
    assigned_date: employeeIncentiveAssignmentsTable.assigned_date,
    end_date: employeeIncentiveAssignmentsTable.end_date,
    status: employeeIncentiveAssignmentsTable.status,
    scheme_name_ar: incentiveSchemesTable.name_ar,
    scheme_status: incentiveSchemesTable.status,
  })
    .from(employeeIncentiveAssignmentsTable)
    .leftJoin(incentiveSchemesTable, eq(employeeIncentiveAssignmentsTable.incentive_scheme_id, incentiveSchemesTable.id))
    .where(eq(employeeIncentiveAssignmentsTable.employee_id, empId))
    .orderBy(desc(employeeIncentiveAssignmentsTable.assigned_date));
  res.json(rows);
}));

/* ═══════════════════════════════════════════════════════════════════
   DAILY ACCRUAL
══════════════════════════════════════════════════════════════════════ */

router.get("/daily-accrual/:employeeId/:date", wrap(async (req, res) => {
  const companyId = req.user!.company_id!;
  const empId = parseInt(String(req.params["employeeId"]), 10);
  const date  = String(req.params["date"]);
  if (!await assertEmployeeOwnership(empId, companyId, res)) return;
  const rows = await db.select().from(dailyIncentiveAccrualTable)
    .where(and(eq(dailyIncentiveAccrualTable.employee_id, empId), eq(dailyIncentiveAccrualTable.accrual_date, date)));
  res.json(rows.map(r => ({ ...r, metric_value: n(r.metric_value), target_value: n(r.target_value), achievement_percentage: n(r.achievement_percentage), accrued_amount: n(r.accrued_amount), created_at: fmt(r.created_at) })));
}));

/* ── Record Metric & Calculate Accrual ────────────────────────── */
router.post("/incentive-metrics/record", wrap(async (req, res) => {
  const companyId = req.user!.company_id!;
  const { employee_id, incentive_rule_id, metric_date, metric_value, source_type, source_document_id } = req.body as Record<string, unknown>;
  if (!employee_id || !incentive_rule_id || !metric_date || metric_value == null) { res.status(400).json({ error: "بيانات المقياس غير مكتملة" }); return; }
  if (!await assertEmployeeOwnership(Number(employee_id), companyId, res)) return;
  if (!await assertRuleOwnership(Number(incentive_rule_id), companyId, res)) return;

  const [rule] = await db.select().from(incentiveRulesTable).where(eq(incentiveRulesTable.id, Number(incentive_rule_id)));
  if (!rule) { res.status(404).json({ error: "قاعدة الحافز غير موجودة" }); return; }
  const slabs = await db.select().from(incentiveSlabsTable)
    .where(eq(incentiveSlabsTable.incentive_rule_id, Number(incentive_rule_id)))
    .orderBy(incentiveSlabsTable.slab_number);

  const mVal = Number(metric_value);
  const tVal = Number(rule.target_value);
  const achievement = tVal > 0 ? (mVal / tVal) * 100 : 0;
  let accrued = 0;

  if (rule.calculation_method === "slab") {
    for (const slab of slabs) {
      const from = Number(slab.from_percentage);
      const to   = slab.to_percentage != null ? Number(slab.to_percentage) : Infinity;
      if (achievement >= from && achievement <= to) {
        accrued = Number(slab.incentive_value);
        break;
      }
    }
  } else if (rule.calculation_method === "tiered") {
    let rem = mVal;
    const tierSize = tVal / slabs.length;
    for (let i = 0; i < slabs.length && rem > 0; i++) {
      const take = Math.min(rem, tierSize);
      accrued += take * Number(slabs[i]?.incentive_value ?? 0);
      rem -= take;
    }
  } else {
    accrued = achievement >= 100 ? Number(rule.incentive_amount ?? 0) : 0;
  }

  await db.insert(incentiveMetricsTable).values({
    incentive_rule_id: Number(incentive_rule_id), employee_id: Number(employee_id),
    metric_date: String(metric_date), metric_value: String(mVal),
    source_document_id: source_document_id ? Number(source_document_id) : null,
    source_type: (source_type as string) ?? "manual",
  });

  const [existing] = await db.select().from(dailyIncentiveAccrualTable)
    .where(and(eq(dailyIncentiveAccrualTable.employee_id, Number(employee_id)), eq(dailyIncentiveAccrualTable.incentive_rule_id, Number(incentive_rule_id)), eq(dailyIncentiveAccrualTable.accrual_date, String(metric_date))));
  if (existing) { res.status(409).json({ error: "يوجد استحقاق مسجّل بالفعل لهذا التاريخ" }); return; }

  const [accrual] = await db.insert(dailyIncentiveAccrualTable).values({
    employee_id: Number(employee_id), incentive_rule_id: Number(incentive_rule_id),
    accrual_date: String(metric_date), metric_value: String(mVal),
    target_value: String(tVal), achievement_percentage: String(achievement),
    accrued_amount: String(accrued), currency: rule.currency,
  }).returning();

  const month = String(metric_date).substring(0, 7);
  const [summary] = await db.select().from(monthlyIncentiveSummaryTable)
    .where(and(eq(monthlyIncentiveSummaryTable.employee_id, Number(employee_id)), eq(monthlyIncentiveSummaryTable.month, month)));
  if (summary) {
    await db.update(monthlyIncentiveSummaryTable)
      .set({ total_accrued: String(Number(summary.total_accrued) + accrued), updated_at: new Date() })
      .where(eq(monthlyIncentiveSummaryTable.id, summary.id));
  } else {
    await db.insert(monthlyIncentiveSummaryTable).values({
      employee_id: Number(employee_id), month, total_accrued: String(accrued),
    });
  }

  res.status(201).json({ ...accrual, metric_value: mVal, target_value: tVal, achievement_percentage: achievement, accrued_amount: accrued, created_at: fmt(accrual.created_at) });
}));

/* ─ Monthly Summary ───────────────────────────────────────────── */
router.get("/monthly-incentive-summary/:employeeId/:month", wrap(async (req, res) => {
  const companyId = req.user!.company_id!;
  const empId = parseInt(String(req.params["employeeId"]), 10);
  const month = String(req.params["month"]);
  if (!await assertEmployeeOwnership(empId, companyId, res)) return;
  const [summary] = await db.select().from(monthlyIncentiveSummaryTable)
    .where(and(eq(monthlyIncentiveSummaryTable.employee_id, empId), eq(monthlyIncentiveSummaryTable.month, month)));
  if (!summary) { res.json({ employee_id: empId, month, total_accrued: 0, status: "no_data" }); return; }
  res.json({ ...summary, total_accrued: n(summary.total_accrued), created_at: fmt(summary.created_at), updated_at: fmt(summary.updated_at) });
}));

/* ─ Incentive Tracking ────────────────────────────────────────── */
router.get("/incentive-tracking/:employeeId", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_employees")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = req.user!.company_id!;
  const empId = parseInt(String(req.params["employeeId"]), 10);
  const month = String(req.query["month"] ?? new Date().toISOString().substring(0, 7));
  if (!await assertEmployeeOwnership(empId, companyId, res)) return;

  const accruals = await db.select({
    id: dailyIncentiveAccrualTable.id, accrual_date: dailyIncentiveAccrualTable.accrual_date,
    metric_value: dailyIncentiveAccrualTable.metric_value, target_value: dailyIncentiveAccrualTable.target_value,
    achievement_percentage: dailyIncentiveAccrualTable.achievement_percentage,
    accrued_amount: dailyIncentiveAccrualTable.accrued_amount, status: dailyIncentiveAccrualTable.status,
    rule_metric_type: incentiveRulesTable.metric_type, scheme_name: incentiveSchemesTable.name_ar,
  })
    .from(dailyIncentiveAccrualTable)
    .leftJoin(incentiveRulesTable, eq(dailyIncentiveAccrualTable.incentive_rule_id, incentiveRulesTable.id))
    .leftJoin(incentiveSchemesTable, eq(incentiveRulesTable.incentive_scheme_id, incentiveSchemesTable.id))
    .where(and(eq(dailyIncentiveAccrualTable.employee_id, empId), sql`LEFT(accrual_date, 7) = ${month}`))
    .orderBy(desc(dailyIncentiveAccrualTable.accrual_date));

  const totalAccrued = accruals.reduce((s, r) => s + n(r.accrued_amount), 0);
  res.json({ employee_id: empId, month, total_accrued: totalAccrued, accruals: accruals.map(r => ({ ...r, metric_value: n(r.metric_value), target_value: n(r.target_value), achievement_percentage: n(r.achievement_percentage), accrued_amount: n(r.accrued_amount) })) });
}));

export default router;
