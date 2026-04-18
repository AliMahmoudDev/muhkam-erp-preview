/**
 * /api/fiscal-years — إدارة السنوات المالية
 */

import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, fiscalYearsTable } from "@workspace/db";
import { wrap } from "../lib/async-handler";
import { requireTenant, getTenant } from "../middleware/auth";
import { writeAuditLog } from "../lib/audit-log";

const router = Router();

/* ── GET /fiscal-years ─── */
router.get("/fiscal-years", requireTenant, wrap(async (req, res) => {
  const companyId = getTenant(req);
  const rows = await db
    .select()
    .from(fiscalYearsTable)
    .where(eq(fiscalYearsTable.company_id, companyId))
    .orderBy(desc(fiscalYearsTable.start_date));
  res.json(rows);
}));

/* ── POST /fiscal-years ─── */
router.post("/fiscal-years", requireTenant, wrap(async (req, res) => {
  const companyId = getTenant(req);
  const { year_label, start_date, end_date, notes } = req.body as {
    year_label?: string; start_date?: string; end_date?: string; notes?: string;
  };

  if (!year_label?.trim()) { res.status(400).json({ error: "اسم السنة المالية مطلوب" }); return; }
  if (!start_date || !end_date) { res.status(400).json({ error: "تاريخ البداية والنهاية مطلوبان" }); return; }
  if (new Date(end_date) <= new Date(start_date)) {
    res.status(400).json({ error: "تاريخ النهاية يجب أن يكون بعد تاريخ البداية" }); return;
  }

  const [row] = await db.insert(fiscalYearsTable).values({
    company_id: companyId, year_label: year_label.trim(),
    start_date, end_date, notes: notes?.trim() ?? null, is_open: true, is_current: false,
  }).returning();

  void writeAuditLog({
    action: "create", record_type: "fiscal_year", record_id: row.id,
    new_value: row, user: { id: req.user!.id, username: req.user!.username }, company_id: companyId,
  });

  res.status(201).json(row);
}));

/* ── PATCH /fiscal-years/:id/set-current ─── */
router.patch("/fiscal-years/:id/set-current", requireTenant, wrap(async (req, res) => {
  const companyId = getTenant(req);
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "id غير صحيح" }); return; }

  const [fy] = await db.select().from(fiscalYearsTable)
    .where(and(eq(fiscalYearsTable.id, id), eq(fiscalYearsTable.company_id, companyId)));
  if (!fy) { res.status(404).json({ error: "السنة المالية غير موجودة" }); return; }
  if (!fy.is_open) { res.status(400).json({ error: "لا يمكن تعيين سنة مقفلة كالسنة الحالية" }); return; }

  await db.transaction(async (tx) => {
    await tx.update(fiscalYearsTable).set({ is_current: false }).where(eq(fiscalYearsTable.company_id, companyId));
    await tx.update(fiscalYearsTable).set({ is_current: true })
      .where(and(eq(fiscalYearsTable.id, id), eq(fiscalYearsTable.company_id, companyId)));
  });

  void writeAuditLog({
    action: "update", record_type: "fiscal_year", record_id: id,
    new_value: { is_current: true }, user: { id: req.user!.id, username: req.user!.username }, company_id: companyId,
  });

  res.json({ message: "تم تعيين السنة المالية الحالية بنجاح" });
}));

/* ── PATCH /fiscal-years/:id/close ─── */
router.patch("/fiscal-years/:id/close", requireTenant, wrap(async (req, res) => {
  const companyId = getTenant(req);
  const userId = req.user!.id;
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "id غير صحيح" }); return; }

  const [fy] = await db.select().from(fiscalYearsTable)
    .where(and(eq(fiscalYearsTable.id, id), eq(fiscalYearsTable.company_id, companyId)));
  if (!fy) { res.status(404).json({ error: "السنة المالية غير موجودة" }); return; }
  if (!fy.is_open) { res.status(400).json({ error: "السنة المالية مقفلة بالفعل" }); return; }

  const [updated] = await db.update(fiscalYearsTable)
    .set({ is_open: false, is_current: false, closed_by: userId, closed_at: new Date() })
    .where(and(eq(fiscalYearsTable.id, id), eq(fiscalYearsTable.company_id, companyId)))
    .returning();

  void writeAuditLog({
    action: "update", record_type: "fiscal_year", record_id: id,
    old_value: { is_open: true }, new_value: { is_open: false, closed_at: updated.closed_at },
    user: { id: userId, username: req.user!.username }, company_id: companyId,
  });

  res.json({ message: "تم إقفال السنة المالية بنجاح", fiscal_year: updated });
}));

/* ── PATCH /fiscal-years/:id/reopen ─── */
router.patch("/fiscal-years/:id/reopen", requireTenant, wrap(async (req, res) => {
  const companyId = getTenant(req);
  const role = req.user?.role;
  if (role !== "admin" && role !== "super_admin") {
    res.status(403).json({ error: "إعادة فتح السنة المالية للمسؤول فقط" }); return;
  }

  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "id غير صحيح" }); return; }

  const [fy] = await db.select().from(fiscalYearsTable)
    .where(and(eq(fiscalYearsTable.id, id), eq(fiscalYearsTable.company_id, companyId)));
  if (!fy) { res.status(404).json({ error: "السنة المالية غير موجودة" }); return; }
  if (fy.is_open) { res.status(400).json({ error: "السنة المالية مفتوحة بالفعل" }); return; }

  const [updated] = await db.update(fiscalYearsTable)
    .set({ is_open: true, closed_by: null, closed_at: null })
    .where(and(eq(fiscalYearsTable.id, id), eq(fiscalYearsTable.company_id, companyId)))
    .returning();

  void writeAuditLog({
    action: "update", record_type: "fiscal_year", record_id: id,
    new_value: { is_open: true }, user: { id: req.user!.id, username: req.user!.username }, company_id: companyId,
  });

  res.json({ message: "تم إعادة فتح السنة المالية بنجاح", fiscal_year: updated });
}));

/* ── DELETE /fiscal-years/:id ─── */
router.delete("/fiscal-years/:id", requireTenant, wrap(async (req, res) => {
  const companyId = getTenant(req);
  const role = req.user?.role;
  if (role !== "admin" && role !== "super_admin") {
    res.status(403).json({ error: "حذف السنة المالية للمسؤول فقط" }); return;
  }

  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "id غير صحيح" }); return; }

  const [fy] = await db.select().from(fiscalYearsTable)
    .where(and(eq(fiscalYearsTable.id, id), eq(fiscalYearsTable.company_id, companyId)));
  if (!fy) { res.status(404).json({ error: "السنة المالية غير موجودة" }); return; }
  if (!fy.is_open) { res.status(400).json({ error: "لا يمكن حذف سنة مالية مقفلة" }); return; }
  if (fy.is_current) { res.status(400).json({ error: "لا يمكن حذف السنة المالية الحالية" }); return; }

  await db.delete(fiscalYearsTable)
    .where(and(eq(fiscalYearsTable.id, id), eq(fiscalYearsTable.company_id, companyId)));

  void writeAuditLog({
    action: "delete", record_type: "fiscal_year", record_id: id,
    old_value: fy, user: { id: req.user!.id, username: req.user!.username }, company_id: companyId,
  });

  res.json({ message: "تم حذف السنة المالية بنجاح" });
}));

export default router;
