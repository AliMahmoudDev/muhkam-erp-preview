/**
 * /api/branches — Branches CRUD (company-scoped)
 * GET    /branches             → list branches with warehouse + safe counts
 * GET    /branches/:id/overview→ full branch details (employees, warehouses, safes, 30-day stats)
 * POST   /branches             → create branch (admin only)
 * PATCH  /branches/:id         → update branch (admin only)
 * DELETE /branches/:id         → delete branch (admin only)
 */
import { Router } from "express";
import { eq, and, sql } from "drizzle-orm";
import {
  db,
  branchesTable,
  warehousesTable,
  safesTable,
  employeesTable,
  salesTable,
  repairJobsTable,
  expensesTable,
  incomeTable,
} from "@workspace/db";
import { authenticate, requireRole, getTenant } from "../middleware/auth";
import { wrap } from "../lib/async-handler";

const router = Router();

router.get("/branches", authenticate, wrap(async (req, res) => {
  const companyId = getTenant(req);

  const rows = await db
    .select()
    .from(branchesTable)
    .where(eq(branchesTable.company_id, companyId))
    .orderBy(branchesTable.id);

  /* جلب أعداد المخازن والخزائن لكل فرع */
  const warehouseCounts = await db
    .select({
      branch_id: warehousesTable.branch_id,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(warehousesTable)
    .where(eq(warehousesTable.company_id, companyId))
    .groupBy(warehousesTable.branch_id);

  const safeCounts = await db
    .select({
      branch_id: safesTable.branch_id,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(safesTable)
    .where(eq(safesTable.company_id, companyId))
    .groupBy(safesTable.branch_id);

  const wMap: Record<number, number> = {};
  const sMap: Record<number, number> = {};
  for (const w of warehouseCounts) if (w.branch_id != null) wMap[w.branch_id] = w.count;
  for (const s of safeCounts)      if (s.branch_id != null) sMap[s.branch_id] = s.count;

  /* عدد المخازن والخزائن الغير مربوطة بفرع */
  const [{ unlinkedW }] = await db
    .select({ unlinkedW: sql<number>`COUNT(*)::int` })
    .from(warehousesTable)
    .where(and(eq(warehousesTable.company_id, companyId), sql`${warehousesTable.branch_id} IS NULL`));
  const [{ unlinkedS }] = await db
    .select({ unlinkedS: sql<number>`COUNT(*)::int` })
    .from(safesTable)
    .where(and(eq(safesTable.company_id, companyId), sql`${safesTable.branch_id} IS NULL`));

  const enriched = rows.map(b => ({
    ...b,
    warehouse_count: wMap[b.id] ?? 0,
    safe_count:      sMap[b.id] ?? 0,
  }));

  res.json({ branches: enriched, unlinked_warehouses: Number(unlinkedW), unlinked_safes: Number(unlinkedS) });
}));

/* ── Branch Overview (تفاصيل الفرع الكاملة) ──────────────────────── */
router.get("/branches/:id/overview", authenticate, wrap(async (req, res) => {
  const id        = parseInt(String(req.params.id), 10);
  const companyId = getTenant(req);

  const [branch] = await db
    .select()
    .from(branchesTable)
    .where(and(eq(branchesTable.id, id), eq(branchesTable.company_id, companyId)));

  if (!branch) { res.status(404).json({ error: "الفرع غير موجود" }); return; }

  const since30 = new Date();
  since30.setDate(since30.getDate() - 30);
  const since30Iso = since30.toISOString();

  /* الموظفون */
  const employees = await db
    .select({
      id:                employeesTable.id,
      name:              sql<string>`concat(${employeesTable.first_name_ar}, ' ', ${employeesTable.last_name_ar})`,
      employee_code:     employeesTable.employee_code,
      employment_status: employeesTable.employment_status,
      salary:            employeesTable.salary,
      currency:          employeesTable.currency,
      salary_type:       employeesTable.salary_type,
      hire_date:         employeesTable.hire_date,
      phone:             employeesTable.phone,
    })
    .from(employeesTable)
    .where(and(
      eq(employeesTable.company_id, companyId),
      eq(employeesTable.branch_id, id),
      sql`${employeesTable.deleted_at} IS NULL`,
    ))
    .orderBy(employeesTable.id);

  /* المخازن */
  const warehouses = await db
    .select()
    .from(warehousesTable)
    .where(and(eq(warehousesTable.company_id, companyId), eq(warehousesTable.branch_id, id)))
    .orderBy(warehousesTable.id);

  /* الخزائن */
  const safes = await db
    .select({
      id:      safesTable.id,
      name:    safesTable.name,
      balance: safesTable.balance,
    })
    .from(safesTable)
    .where(and(eq(safesTable.company_id, companyId), eq(safesTable.branch_id, id)))
    .orderBy(safesTable.id);

  /* إحصاءات 30 يوم — المبيعات */
  const [salesStats] = await db
    .select({
      count: sql<number>`COUNT(*)::int`,
      total: sql<number>`COALESCE(SUM(${salesTable.total_amount}), 0)::numeric`,
    })
    .from(salesTable)
    .where(and(
      eq(salesTable.company_id, companyId),
      eq(salesTable.branch_id, id),
      sql`${salesTable.created_at} >= ${since30Iso}`,
    ));

  /* إحصاءات 30 يوم — الصيانة */
  const [repairStats] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(repairJobsTable)
    .where(and(
      eq(repairJobsTable.company_id, companyId),
      eq(repairJobsTable.branch_id, id),
      sql`${repairJobsTable.created_at} >= ${since30Iso}`,
    ));

  /* إحصاءات 30 يوم — المصروفات */
  const [expenseStats] = await db
    .select({ total: sql<number>`COALESCE(SUM(${expensesTable.amount}), 0)::numeric` })
    .from(expensesTable)
    .where(and(
      eq(expensesTable.company_id, companyId),
      eq(expensesTable.branch_id, id),
      sql`${expensesTable.created_at} >= ${since30Iso}`,
    ));

  /* إحصاءات 30 يوم — الإيرادات الأخرى */
  const [incomeStats] = await db
    .select({ total: sql<number>`COALESCE(SUM(${incomeTable.amount}), 0)::numeric` })
    .from(incomeTable)
    .where(and(
      eq(incomeTable.company_id, companyId),
      eq(incomeTable.branch_id, id),
      sql`${incomeTable.created_at} >= ${since30Iso}`,
    ));

  res.json({
    branch,
    employees,
    warehouses,
    safes,
    stats_30d: {
      sales_count:    salesStats?.count  ?? 0,
      sales_total:    Number(salesStats?.total  ?? 0),
      repairs_count:  repairStats?.count ?? 0,
      expenses_total: Number(expenseStats?.total ?? 0),
      income_total:   Number(incomeStats?.total  ?? 0),
    },
  });
}));

router.post("/branches", authenticate, requireRole("admin"), wrap(async (req, res) => {
  const companyId = getTenant(req);

  const { name, address, phone } = req.body;
  if (!name || !String(name).trim()) {
    res.status(400).json({ error: "اسم الفرع مطلوب" }); return;
  }

  const [branch] = await db
    .insert(branchesTable)
    .values({
      company_id: companyId,
      name:       String(name).trim(),
      address:    address ? String(address).trim() : null,
      phone:      phone   ? String(phone).trim()   : null,
      is_active:  true,
    })
    .returning();
  res.status(201).json(branch);
}));

router.patch("/branches/:id", authenticate, requireRole("admin"), wrap(async (req, res) => {
  const id        = parseInt(String(req.params.id), 10);
  const companyId = getTenant(req);

  const { name, address, phone, is_active } = req.body;
  const updates: Record<string, unknown> = {};
  if (name      !== undefined) updates.name      = String(name).trim();
  if (address   !== undefined) updates.address   = address ? String(address).trim() : null;
  if (phone     !== undefined) updates.phone     = phone   ? String(phone).trim()   : null;
  if (is_active !== undefined) updates.is_active = Boolean(is_active);

  const [branch] = await db
    .update(branchesTable)
    .set(updates)
    .where(and(eq(branchesTable.id, id), eq(branchesTable.company_id, companyId)))
    .returning();

  if (!branch) { res.status(404).json({ error: "الفرع غير موجود" }); return; }
  res.json(branch);
}));

router.delete("/branches/:id", authenticate, requireRole("admin"), wrap(async (req, res) => {
  const id        = parseInt(String(req.params.id), 10);
  const companyId = getTenant(req);

  const [deleted] = await db
    .delete(branchesTable)
    .where(and(eq(branchesTable.id, id), eq(branchesTable.company_id, companyId)))
    .returning();

  if (!deleted) { res.status(404).json({ error: "الفرع غير موجود" }); return; }
  res.json({ success: true });
}));

export default router;
