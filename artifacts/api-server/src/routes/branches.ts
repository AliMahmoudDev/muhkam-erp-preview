/**
 * /api/branches — Branches CRUD (company-scoped)
 * GET    /branches          → list branches with warehouse + safe counts
 * POST   /branches          → create branch (admin only)
 * PATCH  /branches/:id      → update branch (admin only)
 * DELETE /branches/:id      → delete branch (admin only)
 */
import { Router } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, branchesTable, warehousesTable, safesTable } from "@workspace/db";
import { authenticate, requireRole } from "../middleware/auth";
import { wrap } from "../lib/async-handler";

const router = Router();

router.get("/branches", authenticate, wrap(async (req, res) => {
  const companyId = req.user?.company_id ?? null;
  if (companyId === null) { res.json([]); return; }

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

router.post("/branches", authenticate, requireRole("admin"), wrap(async (req, res) => {
  const companyId = req.user?.company_id ?? null;
  if (companyId === null) { res.status(403).json({ error: "غير مسموح" }); return; }

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
  const companyId = req.user?.company_id ?? null;
  if (companyId === null) { res.status(403).json({ error: "غير مسموح" }); return; }

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
  const companyId = req.user?.company_id ?? null;
  if (companyId === null) { res.status(403).json({ error: "غير مسموح" }); return; }

  const [deleted] = await db
    .delete(branchesTable)
    .where(and(eq(branchesTable.id, id), eq(branchesTable.company_id, companyId)))
    .returning();

  if (!deleted) { res.status(404).json({ error: "الفرع غير موجود" }); return; }
  res.json({ success: true });
}));

export default router;
