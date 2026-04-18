/**
 * /api/employee-bonuses  — simple per-employee bonuses (الحافز)
 * /api/employee-custody  — employee custody / imprest (عهدة)
 */
import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import {
  db, employeeBonusesTable, employeeCustodyTable, employeesTable,
} from "@workspace/db";
import { wrap } from "../lib/async-handler";
import { hasPermission } from "../lib/permissions";

const router: IRouter = Router();
const fmtTs = (v: Date | null | undefined) => (v instanceof Date ? v.toISOString() : (v ?? null));
const n = (v: unknown) => (v != null ? Number(v) : 0);

/* ═══════════════════════════════════════════════════════════════
   BONUSES (الحافز)
══════════════════════════════════════════════════════════════════ */

router.get("/employee-bonuses", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_employees")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = req.user!.company_id!;
  const empId = req.query["employee_id"] ? parseInt(String(req.query["employee_id"]), 10) : null;
  const conditions = [eq(employeeBonusesTable.company_id, companyId)];
  if (empId) conditions.push(eq(employeeBonusesTable.employee_id, empId));
  const rows = await db.select().from(employeeBonusesTable)
    .where(and(...conditions))
    .orderBy(desc(employeeBonusesTable.granted_date), desc(employeeBonusesTable.id));
  res.json(rows.map(r => ({ ...r, amount: n(r.amount), created_at: fmtTs(r.created_at) })));
}));

router.post("/employee-bonuses", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_employees")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = req.user!.company_id!;
  const userId = req.user?.id ?? null;
  const { employee_id, amount, reason, granted_date, currency } = req.body as Record<string, unknown>;
  if (!employee_id || amount == null || Number(amount) <= 0) {
    res.status(400).json({ error: "بيانات الحافز غير مكتملة" }); return;
  }
  const [emp] = await db.select().from(employeesTable)
    .where(and(eq(employeesTable.id, Number(employee_id)), eq(employeesTable.company_id, companyId)));
  if (!emp) { res.status(404).json({ error: "الموظف غير موجود" }); return; }
  const [row] = await db.insert(employeeBonusesTable).values({
    company_id: companyId,
    employee_id: Number(employee_id),
    amount: String(Number(amount)),
    reason: (reason as string) ?? null,
    granted_date: String(granted_date ?? new Date().toISOString().split("T")[0]),
    granted_by: userId,
    currency: String(currency ?? emp.currency ?? "EGP"),
  }).returning();
  res.status(201).json({ ...row, amount: n(row.amount), created_at: fmtTs(row.created_at) });
}));

router.delete("/employee-bonuses/:id", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_employees")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = req.user!.company_id!;
  const id = parseInt(String(req.params["id"]), 10);
  await db.delete(employeeBonusesTable)
    .where(and(eq(employeeBonusesTable.id, id), eq(employeeBonusesTable.company_id, companyId)));
  res.json({ ok: true });
}));

/* ═══════════════════════════════════════════════════════════════
   CUSTODY (عهدة)
══════════════════════════════════════════════════════════════════ */

router.get("/employee-custody", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_employees")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = req.user!.company_id!;
  const empId = req.query["employee_id"] ? parseInt(String(req.query["employee_id"]), 10) : null;
  const conditions = [eq(employeeCustodyTable.company_id, companyId)];
  if (empId) conditions.push(eq(employeeCustodyTable.employee_id, empId));
  const rows = await db.select().from(employeeCustodyTable)
    .where(and(...conditions))
    .orderBy(desc(employeeCustodyTable.granted_date), desc(employeeCustodyTable.id));
  res.json(rows.map(r => ({
    ...r,
    amount: n(r.amount),
    returned_amount: n(r.returned_amount),
    created_at: fmtTs(r.created_at),
    updated_at: fmtTs(r.updated_at),
  })));
}));

router.post("/employee-custody", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_employees")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = req.user!.company_id!;
  const userId = req.user?.id ?? null;
  const { employee_id, amount, purpose, granted_date, currency, notes } = req.body as Record<string, unknown>;
  if (!employee_id || amount == null || Number(amount) <= 0) {
    res.status(400).json({ error: "بيانات العهدة غير مكتملة" }); return;
  }
  const [emp] = await db.select().from(employeesTable)
    .where(and(eq(employeesTable.id, Number(employee_id)), eq(employeesTable.company_id, companyId)));
  if (!emp) { res.status(404).json({ error: "الموظف غير موجود" }); return; }
  const [row] = await db.insert(employeeCustodyTable).values({
    company_id: companyId,
    employee_id: Number(employee_id),
    amount: String(Number(amount)),
    purpose: (purpose as string) ?? null,
    granted_date: String(granted_date ?? new Date().toISOString().split("T")[0]),
    granted_by: userId,
    currency: String(currency ?? emp.currency ?? "EGP"),
    notes: (notes as string) ?? null,
  }).returning();
  res.status(201).json({
    ...row, amount: n(row.amount), returned_amount: n(row.returned_amount),
    created_at: fmtTs(row.created_at), updated_at: fmtTs(row.updated_at),
  });
}));

router.post("/employee-custody/:id/settle", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_employees")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = req.user!.company_id!;
  const id = parseInt(String(req.params["id"]), 10);
  const { returned_amount, settled_date, notes } = req.body as Record<string, unknown>;

  const [existing] = await db.select().from(employeeCustodyTable)
    .where(and(eq(employeeCustodyTable.id, id), eq(employeeCustodyTable.company_id, companyId)));
  if (!existing) { res.status(404).json({ error: "العهدة غير موجودة" }); return; }
  if (existing.status === "settled") { res.status(409).json({ error: "العهدة مغلقة بالفعل" }); return; }

  const ret = Number(returned_amount ?? existing.amount);
  const [row] = await db.update(employeeCustodyTable)
    .set({
      returned_amount: String(ret),
      settled_date: String(settled_date ?? new Date().toISOString().split("T")[0]),
      status: "settled",
      notes: (notes as string) ?? existing.notes,
      updated_at: new Date(),
    })
    .where(eq(employeeCustodyTable.id, id))
    .returning();
  res.json({
    ...row, amount: n(row.amount), returned_amount: n(row.returned_amount),
    created_at: fmtTs(row.created_at), updated_at: fmtTs(row.updated_at),
  });
}));

router.delete("/employee-custody/:id", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_employees")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = req.user!.company_id!;
  const id = parseInt(String(req.params["id"]), 10);
  await db.delete(employeeCustodyTable)
    .where(and(eq(employeeCustodyTable.id, id), eq(employeeCustodyTable.company_id, companyId)));
  res.json({ ok: true });
}));

export default router;
