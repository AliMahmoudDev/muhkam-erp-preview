import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, categoriesTable, productsTable } from "@workspace/db";
import { wrap } from "../lib/async-handler";
import { authenticate } from "../middleware/auth";
import { hasPermission } from "../lib/permissions";

const router: IRouter = Router();

router.use(authenticate);

router.get("/categories", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_products")) {
    res.status(403).json({ error: "غير مصرح" }); return;
  }
  const companyId = req.user?.company_id ?? 1;
  const rows = await db
    .select({
      id: categoriesTable.id,
      name: categoriesTable.name,
      company_id: categoriesTable.company_id,
      product_count: sql<number>`cast(count(${productsTable.id}) as int)`,
    })
    .from(categoriesTable)
    .leftJoin(
      productsTable,
      and(
        eq(productsTable.category_id, categoriesTable.id),
        eq(productsTable.company_id, companyId),
      ),
    )
    .where(eq(categoriesTable.company_id, companyId))
    .groupBy(categoriesTable.id, categoriesTable.name, categoriesTable.company_id)
    .orderBy(categoriesTable.name);
  res.json(rows);
}));

router.post("/categories", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_products")) {
    res.status(403).json({ error: "غير مصرح" }); return;
  }
  const name = String(req.body?.name ?? "").trim();
  if (!name) { res.status(400).json({ error: "اسم التصنيف مطلوب" }); return; }
  const companyId = req.user?.company_id ?? 1;

  const [existing] = await db
    .select()
    .from(categoriesTable)
    .where(and(eq(categoriesTable.name, name), eq(categoriesTable.company_id, companyId)));

  if (existing) {
    res.json({ ...existing, product_count: 0 });
    return;
  }

  const [cat] = await db
    .insert(categoriesTable)
    .values({ name, company_id: companyId })
    .returning();

  res.status(201).json({ ...cat, product_count: 0 });
}));

router.put("/categories/:id", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_products")) {
    res.status(403).json({ error: "غير مصرح" }); return;
  }
  const id = parseInt(String(req.params.id), 10);
  const name = String(req.body?.name ?? "").trim();
  if (!name || isNaN(id)) { res.status(400).json({ error: "بيانات غير صحيحة" }); return; }

  const companyId = req.user?.company_id ?? 1;

  const [duplicate] = await db
    .select()
    .from(categoriesTable)
    .where(and(eq(categoriesTable.name, name), eq(categoriesTable.company_id, companyId)));

  if (duplicate && duplicate.id !== id) {
    res.status(409).json({ error: "يوجد تصنيف بهذا الاسم مسبقاً" });
    return;
  }

  const [productCount] = await db
    .select({ c: sql<number>`cast(count(*) as int)` })
    .from(productsTable)
    .where(and(eq(productsTable.category_id, id), eq(productsTable.company_id, companyId)));

  const [cat] = await db
    .update(categoriesTable)
    .set({ name })
    .where(and(eq(categoriesTable.id, id), eq(categoriesTable.company_id, companyId)))
    .returning();

  if (!cat) { res.status(404).json({ error: "التصنيف غير موجود" }); return; }
  res.json({ ...cat, product_count: productCount?.c ?? 0 });
}));

router.delete("/categories/:id", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_products")) {
    res.status(403).json({ error: "غير مصرح" }); return;
  }
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "معرف غير صحيح" }); return; }

  const companyId = req.user?.company_id ?? 1;
  const [purchaseCategory] = await db
    .select({ id: productsTable.id })
    .from(productsTable)
    .where(and(eq(productsTable.category_id, id), eq(productsTable.company_id, companyId)))
    .limit(1);

  if (purchaseCategory) {
    res.status(409).json({ error: "لا يمكن حذف التصنيف لأنه مرتبط بمنتجات" });
    return;
  }

  const result = await db
    .delete(categoriesTable)
    .where(and(eq(categoriesTable.id, id), eq(categoriesTable.company_id, companyId)))
    .returning({ id: categoriesTable.id });
  if (result.length === 0) {
    res.status(404).json({ error: "التصنيف غير موجود" }); return;
  }
  res.json({ success: true, message: "تم حذف التصنيف" });
}));

export default router;
