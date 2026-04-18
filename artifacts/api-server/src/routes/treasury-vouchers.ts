import { Router, type IRouter } from "express";
import { eq, desc, and, sql } from "drizzle-orm";
import { db, treasuryVouchersTable, safesTable, transactionsTable } from "@workspace/db";

import { wrap, httpError } from "../lib/async-handler";
import { hasPermission } from "../lib/permissions";

const router: IRouter = Router();

function getCid(req: any): number {
  return req.user!.company_id!;
}

function fmt(v: typeof treasuryVouchersTable.$inferSelect) {
  return { ...v, amount: Number(v.amount), created_at: v.created_at.toISOString() };
}

router.get("/treasury-vouchers", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_treasury")) {
    res.status(403).json({ error: "ليس لديك صلاحية عرض الخزينة" }); return;
  }
  const cid = getCid(req);
  const vouchers = await db.select().from(treasuryVouchersTable)
    .where(eq(treasuryVouchersTable.company_id, cid))
    .orderBy(desc(treasuryVouchersTable.created_at));
  res.json(vouchers.map(fmt));
}));

router.get("/treasury-vouchers/safe/:safeId", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_treasury")) {
    res.status(403).json({ error: "ليس لديك صلاحية عرض الخزينة" }); return;
  }
  const cid = getCid(req);
  const safeId = parseInt(req.params.safeId as string);
  if (isNaN(safeId)) { res.status(400).json({ error: "معرّف غير صالح" }); return; }
  const vouchers = await db.select().from(treasuryVouchersTable)
    .where(and(eq(treasuryVouchersTable.safe_id, safeId), eq(treasuryVouchersTable.company_id, cid)))
    .orderBy(desc(treasuryVouchersTable.created_at));
  res.json(vouchers.map(fmt));
}));

router.post("/treasury-vouchers", wrap(async (req, res) => {
  const cid = getCid(req);
  const { type, safe_id, amount, party_name, description, category } = req.body;
  if (!type || !safe_id || !amount || !description) {
    res.status(400).json({ error: "البيانات غير مكتملة" }); return;
  }
  const [safe] = await db.select().from(safesTable).where(and(
    eq(safesTable.id, parseInt(safe_id)),
    eq(safesTable.company_id, cid),
  ));
  if (!safe) { res.status(404).json({ error: "الخزانة غير موجودة" }); return; }

  const amt = Number(amount);
  const voucher_no = `${type === "receipt" ? "RV" : "PV"}-${Date.now()}`;

  const voucher = await db.transaction(async (tx) => {
    // تحديث ذرّي مع شرط كفاية الرصيد للسحب
    if (type === "receipt") {
      await tx.update(safesTable)
        .set({ balance: sql`${safesTable.balance} + ${String(amt)}` })
        .where(and(eq(safesTable.id, safe.id), eq(safesTable.company_id, cid)));
    } else {
      const debited = await tx.update(safesTable)
        .set({ balance: sql`${safesTable.balance} - ${String(amt)}` })
        .where(and(
          eq(safesTable.id, safe.id),
          eq(safesTable.company_id, cid),
          sql`${safesTable.balance} >= ${String(amt)}`,
        ))
        .returning();
      if (!debited[0]) throw httpError(400, `رصيد الخزانة غير كافٍ (${Number(safe.balance).toFixed(2)} ج.م)`);
    }
    const [v] = await tx.insert(treasuryVouchersTable).values({
      voucher_no, type,
      safe_id: safe.id, safe_name: safe.name,
      amount: String(amt), party_name: party_name ?? null,
      description, category: category ?? null,
      company_id: cid,
    }).returning();
    await tx.insert(transactionsTable).values({
      type: `voucher_${type}`,
      reference_type: "treasury_voucher",
      reference_id: v.id,
      safe_id: safe.id, safe_name: safe.name,
      amount: String(amt),
      direction: type === "receipt" ? "in" : "out",
      description: `${type === "receipt" ? "سند قبض" : "سند صرف"}: ${description}`,
      date: new Date().toISOString().split("T")[0],
      company_id: cid,
    });
    return v;
  });
  res.status(201).json(fmt(voucher));
}));

router.delete("/treasury-vouchers/:id", wrap(async (req, res) => {
  const cid = getCid(req);
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: "معرّف غير صالح" }); return; }
  await db.transaction(async (tx) => {
    const [v] = await tx.select().from(treasuryVouchersTable)
      .where(and(eq(treasuryVouchersTable.id, id), eq(treasuryVouchersTable.company_id, cid)));
    if (!v) throw httpError(404, "غير موجود");
    if (v.type === "receipt") {
      // عكس قبض ⇒ خصم من الخزينة بشرط كفاية الرصيد
      const debited = await tx.update(safesTable)
        .set({ balance: sql`${safesTable.balance} - ${String(Number(v.amount))}` })
        .where(and(
          eq(safesTable.id, v.safe_id),
          eq(safesTable.company_id, cid),
          sql`${safesTable.balance} >= ${String(Number(v.amount))}`,
        ))
        .returning();
      if (!debited[0]) throw httpError(400, "رصيد الخزانة غير كافٍ لإلغاء سند القبض — تم صرف المبلغ بالفعل");
    } else {
      await tx.update(safesTable)
        .set({ balance: sql`${safesTable.balance} + ${String(Number(v.amount))}` })
        .where(and(eq(safesTable.id, v.safe_id), eq(safesTable.company_id, cid)));
    }
    await tx.delete(treasuryVouchersTable).where(and(eq(treasuryVouchersTable.id, id), eq(treasuryVouchersTable.company_id, cid)));
  });
  res.json({ success: true });
}));

export default router;
