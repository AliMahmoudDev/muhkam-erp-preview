import { Router, type IRouter } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { db, scrapItemsTable } from "@workspace/db";
import { wrap } from "../lib/async-handler";
import { requireFeature } from "../middleware/feature-guard";

const router: IRouter = Router();
router.use("/scrap-items", requireFeature("maintenance"));

function ctx(req: Express.Request) {
  const u = (req as unknown as { user: { company_id: number; id: number; name: string } }).user;
  return { company_id: u.company_id, user_id: u.id, user_name: u.name };
}

router.get("/scrap-items", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const rows = await db.select().from(scrapItemsTable)
    .where(eq(scrapItemsTable.company_id, company_id))
    .orderBy(desc(scrapItemsTable.created_at));
  return res.json(rows);
}));

router.get("/scrap-items/stats", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const [r] = await db.select({
    count: sql<number>`count(*)`,
    total_value: sql<number>`COALESCE(sum(${scrapItemsTable.quantity} * ${scrapItemsTable.unit_cost}), 0)`,
  }).from(scrapItemsTable).where(eq(scrapItemsTable.company_id, company_id));
  return res.json({
    count: Number(r?.count ?? 0),
    total_value: Number(r?.total_value ?? 0),
  });
}));

router.post("/scrap-items", wrap(async (req, res) => {
  const { company_id, user_id, user_name } = ctx(req);
  const b = req.body as Record<string, unknown>;
  if (!b.product_name) return res.status(400).json({ error: "اسم المنتج مطلوب" });
  const [row] = await db.insert(scrapItemsTable).values({
    company_id,
    product_id:    b.product_id ? Number(b.product_id) : null,
    product_name:  String(b.product_name),
    quantity:      String(b.quantity ?? "1"),
    unit_cost:     String(b.unit_cost ?? "0"),
    warehouse_id:  b.warehouse_id ? Number(b.warehouse_id) : null,
    reason:        b.reason ? String(b.reason) : null,
    source_type:   b.source_type ? String(b.source_type) : "manual",
    source_id:     b.source_id ? Number(b.source_id) : null,
    created_by:    user_id,
    created_by_name: user_name,
  }).returning();
  return res.status(201).json(row);
}));

router.delete("/scrap-items/:id", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const id = Number(req.params.id);
  await db.delete(scrapItemsTable)
    .where(and(eq(scrapItemsTable.id, id), eq(scrapItemsTable.company_id, company_id)));
  return res.json({ ok: true });
}));

export default router;
