import { Router, type IRouter } from "express";
import { eq, and, ne, gte, lt, sql } from "drizzle-orm";
import {
  db, salesTargetsTable, erpUsersTable, salesTable,
} from "@workspace/db";
import { wrap } from "../lib/async-handler";
import { hasPermission } from "../lib/permissions";

const router: IRouter = Router();

function currentYearMonth() {
  return new Date().toISOString().slice(0, 7);
}

function monthRange(yearMonth: string): { start: string; end: string } {
  const [y, m] = yearMonth.split("-").map(Number);
  const nextM = m === 12 ? 1 : m + 1;
  const nextY = m === 12 ? y + 1 : y;
  return {
    start: `${y}-${String(m).padStart(2, "0")}-01`,
    end:   `${nextY}-${String(nextM).padStart(2, "0")}-01`,
  };
}

/* ── GET /api/sales-targets?month=YYYY-MM ──────────────────────────── */
router.get("/sales-targets", wrap(async (req, res) => {
  const companyId = req.user!.company_id!;
  const month = (req.query.month as string) || currentYearMonth();

  const [users, targets, achievements] = await Promise.all([
    db.select({ id: erpUsersTable.id, name: erpUsersTable.name, role: erpUsersTable.role })
      .from(erpUsersTable)
      .where(and(
        eq(erpUsersTable.company_id, companyId),
        ne(erpUsersTable.role, "super_admin"),
      )),

    db.select()
      .from(salesTargetsTable)
      .where(and(
        eq(salesTargetsTable.company_id, companyId),
        eq(salesTargetsTable.year_month, month),
      )),

    (() => {
      const { start, end } = monthRange(month);
      return db.select({
        salesperson_id: salesTable.salesperson_id,
        achieved: sql<string>`coalesce(sum(${salesTable.total_amount}), 0)`.as("achieved"),
      })
        .from(salesTable)
        .where(and(
          eq(salesTable.company_id, companyId),
          ne(salesTable.status, "cancelled"),
          gte(salesTable.date, start),
          lt(salesTable.date, end),
        ))
        .groupBy(salesTable.salesperson_id);
    })(),
  ]);

  const targetMap  = new Map(targets.map(t => [t.user_id, t]));
  const achieveMap = new Map(achievements.map(a => [a.salesperson_id, Number(a.achieved)]));

  const items = users.map(u => ({
    user_id:         u.id,
    user_name:       u.name,
    role:            u.role,
    target_id:       targetMap.get(u.id)?.id      ?? null,
    target_amount:   Number(targetMap.get(u.id)?.target_amount  ?? 0),
    achieved_amount: achieveMap.get(u.id) ?? 0,
  }));

  res.json({ month, items });
}));

/* ── POST /api/sales-targets — upsert ─────────────────────────────── */
router.post("/sales-targets", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_users")) {
    res.status(403).json({ error: "غير مصرح" }); return;
  }
  const companyId = req.user!.company_id!;
  const { user_id, year_month, target_amount } = req.body as {
    user_id: number; year_month: string; target_amount: number;
  };

  if (!user_id || !year_month || target_amount == null) {
    res.status(400).json({ error: "بيانات ناقصة" }); return;
  }

  if (target_amount <= 0) {
    await db.delete(salesTargetsTable).where(and(
      eq(salesTargetsTable.company_id, companyId),
      eq(salesTargetsTable.user_id, user_id),
      eq(salesTargetsTable.year_month, year_month),
    ));
    res.json({ deleted: true }); return;
  }

  const [existing] = await db.select()
    .from(salesTargetsTable)
    .where(and(
      eq(salesTargetsTable.company_id, companyId),
      eq(salesTargetsTable.user_id, user_id),
      eq(salesTargetsTable.year_month, year_month),
    ));

  if (existing) {
    const [updated] = await db.update(salesTargetsTable)
      .set({ target_amount: String(target_amount), updated_at: new Date() })
      .where(eq(salesTargetsTable.id, existing.id))
      .returning();
    res.json(updated); return;
  }

  const [created] = await db.insert(salesTargetsTable)
    .values({ company_id: companyId, user_id, year_month, target_amount: String(target_amount) })
    .returning();
  res.json(created);
}));

/* ── DELETE /api/sales-targets/:id ────────────────────────────────── */
router.delete("/sales-targets/:id", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_users")) {
    res.status(403).json({ error: "غير مصرح" }); return;
  }
  const companyId = req.user!.company_id!;
  const id = parseInt(req.params.id);

  await db.delete(salesTargetsTable).where(and(
    eq(salesTargetsTable.id, id),
    eq(salesTargetsTable.company_id, companyId),
  ));
  res.json({ ok: true });
}));

export default router;
