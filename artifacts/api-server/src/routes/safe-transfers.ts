import { Router, type IRouter } from "express";
import { eq, desc, and, sql, inArray } from "drizzle-orm";
import { db, safesTable, safeTransfersTable, transactionsTable } from "@workspace/db";

import { wrap, httpError } from "../lib/async-handler";
import { assertPeriodOpen } from "../lib/period-lock";
import { hasPermission } from "../lib/permissions";

const router: IRouter = Router();

router.get("/safe-transfers", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_treasury")) {
    res.status(403).json({ error: "ليس لديك صلاحية عرض الخزينة" }); return;
  }
  const companyId: number = ((req as any).user.company_id as number);
  const safeLimit = Math.min(2000, Math.max(1, parseInt(String(req.query["limit"] ?? "500"), 10)));
  const items = await db.select().from(safeTransfersTable)
    .where(eq(safeTransfersTable.company_id, companyId))
    .orderBy(desc(safeTransfersTable.created_at))
    .limit(safeLimit);
  res.json(items.map(t => ({
    ...t,
    amount: Number(t.amount),
    created_at: t.created_at.toISOString(),
  })));
}));

router.post("/safe-transfers", wrap(async (req, res) => {
  const userRole = req.user?.role ?? "cashier";
  if (userRole !== "admin" && userRole !== "manager") {
    res.status(403).json({ error: "ليس لديك صلاحية لتحويل الخزائن — يُسمح للمدير فقط" }); return;
  }

  const { from_safe_id, to_safe_id, amount, notes, date } = req.body;

  await assertPeriodOpen(date ?? new Date().toISOString().split("T")[0], req);

  if (!from_safe_id || !to_safe_id || !amount) {
    res.status(400).json({ error: "البيانات غير مكتملة" }); return;
  }
  if (parseInt(from_safe_id) === parseInt(to_safe_id)) {
    res.status(400).json({ error: "لا يمكن التحويل من وإلى نفس الخزينة" }); return;
  }
  const amt = Number(amount);
  if (isNaN(amt) || amt <= 0) { res.status(400).json({ error: "المبلغ غير صحيح" }); return; }

  const transferRef = `TRF-${Date.now()}`;
  const txDate = date ?? new Date().toISOString().split("T")[0];

  const companyId: number = ((req as any).user.company_id as number);
  const fromId = parseInt(from_safe_id);
  const toId   = parseInt(to_safe_id);
  if (Number.isNaN(fromId) || Number.isNaN(toId)) {
    res.status(400).json({ error: "معرف الخزينة غير صالح" });
    return;
  }

  const precheckSafes = await db.select({
    id: safesTable.id,
    company_id: safesTable.company_id,
  }).from(safesTable).where(inArray(safesTable.id, [fromId, toId]));
  const fromSafe = precheckSafes.find((safe) => safe.id === fromId);
  const toSafe = precheckSafes.find((safe) => safe.id === toId);
  const crossTenantError = { error: "لا يمكن التحويل بين خزائن شركات مختلفة" };

  if (!fromSafe || fromSafe.company_id !== companyId) {
    res.status(403).json(crossTenantError);
    return;
  }
  if (!toSafe || toSafe.company_id !== companyId) {
    res.status(403).json(crossTenantError);
    return;
  }

  const result = await db.transaction(async (tx) => {
    // قفل الصفّين بترتيب الـ id الأصغر أولاً لمنع الـ deadlock بين عمليتين متعاكستين
    const [first, second] = fromId < toId ? [fromId, toId] : [toId, fromId];
    const lockRes = await tx.execute(sql`
      SELECT id, name, balance FROM ${safesTable}
      WHERE id IN (${first}, ${second}) AND company_id = ${companyId}
      ORDER BY id
      FOR UPDATE
    `);
    const lockedRows = ((lockRes as unknown as { rows?: Array<{ id: number; name: string; balance: string }> }).rows
      ?? (lockRes as unknown as Array<{ id: number; name: string; balance: string }>));
    const fromSafe = lockedRows.find((r) => r.id === fromId);
    const toSafe   = lockedRows.find((r) => r.id === toId);
    if (!fromSafe) throw httpError(400, "خزينة المصدر غير موجودة أو لا تنتمي لشركتك");
    if (!toSafe)   throw httpError(400, "خزينة الوجهة غير موجودة أو لا تنتمي لشركتك");

    // خصم ذرّي مع شرط كفاية الرصيد
    const debited = await tx.update(safesTable)
      .set({ balance: sql`${safesTable.balance} - ${String(amt)}` })
      .where(and(
        eq(safesTable.id, fromSafe.id),
        eq(safesTable.company_id, companyId),
        sql`${safesTable.balance} >= ${String(amt)}`,
      ))
      .returning();
    if (!debited[0]) {
      throw httpError(400, `رصيد خزينة "${fromSafe.name}" غير كافٍ (${Number(fromSafe.balance).toFixed(2)} ج.م)`);
    }
    await tx.update(safesTable)
      .set({ balance: sql`${safesTable.balance} + ${String(amt)}` })
      .where(and(eq(safesTable.id, toSafe.id), eq(safesTable.company_id, companyId)));

    // ── سجل في جدول safe_transfers للتاريخ ─────────────────────────────────
    await tx.insert(safeTransfersTable).values({
      from_safe_id: fromSafe.id,
      from_safe_name: fromSafe.name,
      to_safe_id: toSafe.id,
      to_safe_name: toSafe.name,
      amount: String(amt),
      notes: notes ?? null,
      company_id: companyId,
    });

    // ── سجلان في transactions للدفتر المالي المركزي ─────────────────────────
    await tx.insert(transactionsTable).values({
      type: "transfer_out",
      reference_type: "safe_transfer",
      safe_id: fromSafe.id,
      safe_name: fromSafe.name,
      amount: String(amt),
      direction: "out",
      description: `تحويل ${transferRef} → ${toSafe.name}${notes ? ` (${notes})` : ""}`,
      date: txDate,
      company_id: companyId,
    });

    await tx.insert(transactionsTable).values({
      type: "transfer_in",
      reference_type: "safe_transfer",
      safe_id: toSafe.id,
      safe_name: toSafe.name,
      amount: String(amt),
      direction: "in",
      description: `تحويل ${transferRef} ← ${fromSafe.name}${notes ? ` (${notes})` : ""}`,
      date: txDate,
      company_id: companyId,
    });

    return { transfer_ref: transferRef, from: fromSafe.name, to: toSafe.name, amount: amt };
  });

  res.status(201).json(result);
}));

export default router;
