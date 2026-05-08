import { Router, type IRouter } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { db, scrapItemsTable } from "@workspace/db";
import { wrap } from "../lib/async-handler";
import { requireFeature } from "../middleware/feature-guard";
import { z } from "zod/v4";

const router: IRouter = Router();
router.use("/scrap-items", requireFeature("maintenance"));

function ctx(req: Express.Request) {
  const u = (req as unknown as { user: { company_id: number; id: number; name: string } }).user;
  return { company_id: u.company_id, user_id: u.id, user_name: u.name };
}

const CreateScrapItemBody = z.object({
  product_name: z.string().min(1, "اسم المنتج مطلوب"),
  product_id:   z.number().int().positive().nullish(),
  quantity:     z.number().positive("الكمية يجب أن تكون رقماً موجباً").optional().default(1),
  unit_cost:    z.number().min(0, "التكلفة يجب أن تكون صفراً أو أكثر").optional().default(0),
  warehouse_id: z.number().int().positive().nullish(),
  reason:       z.string().nullish(),
  source_type:  z.string().optional().default("manual"),
  source_id:    z.number().int().positive().nullish(),
});

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

  const parsed = CreateScrapItemBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "بيانات المخلفات غير صحيحة", details: parsed.error.issues.map(i => i.message) });
  }

  const { product_name, product_id, quantity, unit_cost, warehouse_id, reason, source_type, source_id } = parsed.data;

  const [row] = await db.insert(scrapItemsTable).values({
    company_id,
    product_id:    product_id ?? null,
    product_name,
    quantity:      String(quantity),
    unit_cost:     String(unit_cost),
    warehouse_id:  warehouse_id ?? null,
    reason:        reason ?? null,
    source_type,
    source_id:     source_id ?? null,
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
