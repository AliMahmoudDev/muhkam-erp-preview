import { Router, type IRouter } from "express";
import { eq, desc, and, sql, inArray } from "drizzle-orm";
import { db, safesTable, safeTransfersTable, transactionsTable, expensesTable } from "@workspace/db";

import { wrap, httpError } from "../lib/async-handler";
import { assertPeriodOpen } from "../lib/period-lock";
import { hasPermission } from "../lib/permissions";

const router: IRouter = Router();

router.get("/safe-transfers", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_treasury")) {
    res.status(403).json({ error: "ليس لديك صلاحية عرض الخزينة" }); return;
  }
  const companyId: number = req.user!.company_id!;
  const safeLimit = Math.min(2000, Math.max(1, parseInt(String(req.query["limit"] ?? "500"), 10)));
  const items = await db.select().from(safeTransfersTable)
    .where(eq(safeTransfersTable.company_id, companyId))
    .orderBy(desc(safeTransfersTable.created_at))
    .limit(safeLimit);
  res.json(items.map(t => ({
    ...t,
    amount:     Number(t.amount),
    fee_amount: Number(t.fee_amount ?? 0),
    fee_rate:   Number(t.fee_rate   ?? 0),
    net_amount: Number(t.net_amount ?? t.amount),
    created_at: t.created_at.toISOString(),
  })));
}));

router.post("/safe-transfers", wrap(async (req, res) => {
  const userRole = req.user?.role ?? "cashier";
  if (userRole !== "admin" && userRole !== "manager") {
    res.status(403).json({ error: "ليس لديك صلاحية لتحويل الخزائن — يُسمح للمدير فقط" }); return;
  }

  const { from_safe_id, to_safe_id, amount, notes, date, fee_type, fee_rate } = req.body;

  await assertPeriodOpen(date ?? new Date().toISOString().split("T")[0], req);

  if (!from_safe_id || !to_safe_id || !amount) {
    res.status(400).json({ error: "البيانات غير مكتملة" }); return;
  }
  if (parseInt(from_safe_id) === parseInt(to_safe_id)) {
    res.status(400).json({ error: "لا يمكن التحويل من وإلى نفس الخزينة" }); return;
  }
  const amt = Number(amount);
  if (isNaN(amt) || amt <= 0) { res.status(400).json({ error: "المبلغ غير صحيح" }); return; }

  /* ── حساب الرسوم ──────────────────────────────────────────── */
  const feeType: string = fee_type ?? "none";
  const feeRate = Number(fee_rate ?? 0);
  let feeAmt = 0;
  if (feeType === "fixed") {
    feeAmt = feeRate;
  } else if (feeType === "percentage") {
    feeAmt = amt * feeRate / 100;
  }
  feeAmt = Math.max(0, Math.round(feeAmt * 100) / 100);
  const netAmt = Math.round((amt - feeAmt) * 100) / 100;
  if (netAmt < 0) {
    res.status(400).json({ error: "الرسوم أكبر من المبلغ — الصافي لا يمكن أن يكون سالباً" }); return;
  }

  const transferRef = `TRF-${Date.now()}`;
  const txDate = date ?? new Date().toISOString().split("T")[0];

  const companyId: number = req.user!.company_id!;
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
  const fromSafeCheck = precheckSafes.find((safe) => safe.id === fromId);
  const toSafeCheck   = precheckSafes.find((safe) => safe.id === toId);
  const crossTenantError = { error: "لا يمكن التحويل بين خزائن شركات مختلفة" };

  if (!fromSafeCheck || fromSafeCheck.company_id !== companyId) {
    res.status(403).json(crossTenantError); return;
  }
  if (!toSafeCheck || toSafeCheck.company_id !== companyId) {
    res.status(403).json(crossTenantError); return;
  }

  const result = await db.transaction(async (tx) => {
    // قفل الصفّين بترتيب الـ id الأصغر أولاً لمنع الـ deadlock
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

    // خصم المبلغ الكامل من المصدر
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

    // إضافة الصافي فقط للوجهة
    await tx.update(safesTable)
      .set({ balance: sql`${safesTable.balance} + ${String(netAmt)}` })
      .where(and(eq(safesTable.id, toSafe.id), eq(safesTable.company_id, companyId)));

    // ── سجل التحويل ─────────────────────────────────────────────
    await tx.insert(safeTransfersTable).values({
      from_safe_id:   fromSafe.id,
      from_safe_name: fromSafe.name,
      to_safe_id:     toSafe.id,
      to_safe_name:   toSafe.name,
      amount:         String(amt),
      fee_type:       feeType,
      fee_rate:       String(feeRate),
      fee_amount:     String(feeAmt),
      net_amount:     String(netAmt),
      notes:          notes ?? null,
      company_id:     companyId,
    });

    // ── سجلات المعاملات المالية ─────────────────────────────────
    await tx.insert(transactionsTable).values({
      type: "transfer_out",
      reference_type: "safe_transfer",
      safe_id:   fromSafe.id,
      safe_name: fromSafe.name,
      amount:    String(amt),
      direction: "out",
      description: `تحويل ${transferRef} → ${toSafe.name}${notes ? ` (${notes})` : ""}`,
      date: txDate,
      company_id: companyId,
    });

    await tx.insert(transactionsTable).values({
      type: "transfer_in",
      reference_type: "safe_transfer",
      safe_id:   toSafe.id,
      safe_name: toSafe.name,
      amount:    String(netAmt),
      direction: "in",
      description: `تحويل ${transferRef} ← ${fromSafe.name}${notes ? ` (${notes})` : ""}`,
      date: txDate,
      company_id: companyId,
    });

    // ── مصروف الرسوم (إن وُجدت) ─────────────────────────────────
    if (feeAmt > 0) {
      await tx.insert(expensesTable).values({
        category:    "رسوم تحويل",
        amount:      String(feeAmt),
        description: `رسوم تحويل ${transferRef} من ${fromSafe.name} إلى ${toSafe.name}`,
        safe_id:     fromSafe.id,
        safe_name:   fromSafe.name,
        company_id:  companyId,
      });
      // سجل خروج المبلغ من transactions أيضاً
      await tx.insert(transactionsTable).values({
        type: "expense",
        reference_type: "safe_transfer_fee",
        safe_id:   fromSafe.id,
        safe_name: fromSafe.name,
        amount:    String(feeAmt),
        direction: "out",
        description: `رسوم تحويل ${transferRef}`,
        date: txDate,
        company_id: companyId,
      });
    }

    return {
      transfer_ref: transferRef,
      from:       fromSafe.name,
      to:         toSafe.name,
      amount:     amt,
      fee_type:   feeType,
      fee_amount: feeAmt,
      net_amount: netAmt,
    };
  });

  res.status(201).json(result);
}));

export default router;
