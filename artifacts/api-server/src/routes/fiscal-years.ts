/**
 * /api/fiscal-years — إدارة السنوات المالية
 */

import { Router } from "express";
import { eq, and, desc, sql, count } from "drizzle-orm";
import { db, fiscalYearsTable, accountsTable, journalEntriesTable, journalEntryLinesTable } from "@workspace/db";
import { wrap, httpError } from "../lib/async-handler";
import { requireTenant, getTenant } from "../middleware/auth";
import { writeAuditLog } from "../lib/audit-log";
import { getOrCreateAccount } from "../lib/auto-account";
import { requireFeature } from "../middleware/feature-guard";

const router = Router();
router.use("/fiscal-years", requireFeature("accounting"));

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

/* ── POST /fiscal-years/:id/closing-entries — قيود الإقفال المحاسبي ─── */
router.post("/fiscal-years/:id/closing-entries", requireTenant, wrap(async (req, res) => {
  const companyId = getTenant(req);
  const role = req.user?.role;
  if (role !== "admin" && role !== "super_admin") throw httpError(403, "للمسؤول فقط");

  const id = parseInt(String(req.params.id));
  if (isNaN(id)) throw httpError(400, "id غير صحيح");

  const [fy] = await db.select().from(fiscalYearsTable)
    .where(and(eq(fiscalYearsTable.id, id), eq(fiscalYearsTable.company_id, companyId)));
  if (!fy) throw httpError(404, "السنة المالية غير موجودة");

  // جلب أرصدة حسابات الإيرادات والمصروفات خلال فترة السنة المالية
  const balances = await db.execute(sql`
    SELECT
      a.id,
      a.code,
      a.name,
      a.type,
      COALESCE(SUM(CAST(jel.debit AS FLOAT8)), 0)  AS total_debit,
      COALESCE(SUM(CAST(jel.credit AS FLOAT8)), 0) AS total_credit
    FROM accounts a
    JOIN journal_entry_lines jel ON jel.account_id = a.id
    JOIN journal_entries je      ON je.id = jel.entry_id AND je.status = 'posted'
    WHERE a.company_id = ${companyId}
      AND je.company_id = ${companyId}
      AND a.type IN ('revenue', 'expense')
      AND je.date >= ${fy.start_date}
      AND je.date <= ${fy.end_date}
      AND je.description NOT LIKE 'إقفال السنة المالية%'
    GROUP BY a.id, a.code, a.name, a.type
    HAVING COALESCE(SUM(CAST(jel.debit AS FLOAT8)), 0) != COALESCE(SUM(CAST(jel.credit AS FLOAT8)), 0)
  `);

  const rows = balances.rows as Array<{
    id: number; code: string; name: string; type: string;
    total_debit: number; total_credit: number;
  }>;

  if (rows.length === 0) throw httpError(400, "لا توجد حسابات إيرادات أو مصروفات لإقفالها في هذه الفترة");

  let totalRevenue = 0;
  let totalExpense = 0;

  type JLine = { accountId: number; accountCode: string; accountName: string; debit: number; credit: number };
  const lines: JLine[] = [];

  for (const row of rows) {
    const netDebit  = Number(row.total_debit);
    const netCredit = Number(row.total_credit);
    if (row.type === "revenue") {
      const netBalance = netCredit - netDebit;
      if (netBalance > 0.001) {
        lines.push({ accountId: Number(row.id), accountCode: row.code, accountName: row.name, debit: netBalance, credit: 0 });
        totalRevenue += netBalance;
      }
    } else if (row.type === "expense") {
      const netBalance = netDebit - netCredit;
      if (netBalance > 0.001) {
        lines.push({ accountId: Number(row.id), accountCode: row.code, accountName: row.name, debit: 0, credit: netBalance });
        totalExpense += netBalance;
      }
    }
  }

  const netIncome = totalRevenue - totalExpense;

  // حساب الأرباح المحتجزة
  const retainedEarnings = await getOrCreateAccount(
    { code: "EQUITY-RETAINED", name: "الأرباح المحتجزة", type: "equity" }, companyId
  );

  if (netIncome > 0.001) {
    lines.push({ accountId: retainedEarnings.id, accountCode: retainedEarnings.code, accountName: retainedEarnings.name, debit: 0, credit: netIncome });
  } else if (netIncome < -0.001) {
    lines.push({ accountId: retainedEarnings.id, accountCode: retainedEarnings.code, accountName: retainedEarnings.name, debit: Math.abs(netIncome), credit: 0 });
  }

  if (lines.length === 0) throw httpError(400, "لا يوجد رصيد لإقفاله");

  // إنشاء القيد
  const [{ total }] = await db.select({ total: count() })
    .from(journalEntriesTable).where(eq(journalEntriesTable.company_id, companyId));

  const entryNo = `JE-${String(Number(total) + 1).padStart(5, "0")}`;
  const totalDebit  = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);

  const [entry] = await db.insert(journalEntriesTable).values({
    entry_no: entryNo,
    date: fy.end_date,
    description: `إقفال السنة المالية ${fy.year_label}`,
    status: "posted",
    reference: `CLOSING-${fy.id}`,
    total_debit: String(totalDebit),
    total_credit: String(totalCredit),
    company_id: companyId,
  }).returning();

  await db.insert(journalEntryLinesTable).values(
    lines.map(l => ({
      entry_id: entry.id,
      account_id: l.accountId,
      account_code: l.accountCode,
      account_name: l.accountName,
      debit: String(l.debit),
      credit: String(l.credit),
    }))
  );

  // تحديث أرصدة الحسابات
  for (const l of lines) {
    const delta = l.debit - l.credit;
    if (Math.abs(delta) < 0.001) continue;
    await db.update(accountsTable)
      .set({ current_balance: sql`current_balance + ${String(delta)}::numeric` })
      .where(eq(accountsTable.id, l.accountId));
  }

  res.json({
    message: "تم إنشاء قيود الإقفال بنجاح",
    entry_no: entryNo,
    total_revenue: Math.round(totalRevenue * 100) / 100,
    total_expense: Math.round(totalExpense * 100) / 100,
    net_income: Math.round(netIncome * 100) / 100,
    lines_count: lines.length,
  });
}));

export default router;
