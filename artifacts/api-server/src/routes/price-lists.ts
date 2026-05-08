import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, priceListsTable, priceListItemsTable, productsTable, customersTable } from "@workspace/db";
import { wrap, httpError } from "../lib/async-handler";
import { hasPermission } from "../lib/permissions";
import { getTenant } from "../middleware/auth";
import { z } from "zod/v4";

const router: IRouter = Router();

// ── قوائم الأسعار - عرض الكل ─────────────────────────────────────────────
router.get("/price-lists", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_products")) {
    res.status(403).json({ error: "غير مصرح" }); return;
  }
  const companyId = getTenant(req);
  const lists = await db.select().from(priceListsTable)
    .where(eq(priceListsTable.company_id, companyId))
    .orderBy(priceListsTable.created_at);
  res.json(lists);
}));

// ── قوائم الأسعار - تفاصيل قائمة واحدة مع منتجاتها ──────────────────────
router.get("/price-lists/:id", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_products")) {
    res.status(403).json({ error: "غير مصرح" }); return;
  }
  const companyId = getTenant(req);
  const id = Number(req.params.id);
  if (!id) throw httpError(400, "معرف القائمة غير صالح");

  const [list] = await db.select().from(priceListsTable)
    .where(and(eq(priceListsTable.id, id), eq(priceListsTable.company_id, companyId)));
  if (!list) throw httpError(404, "القائمة غير موجودة");

  const items = await db
    .select({
      id: priceListItemsTable.id,
      price_list_id: priceListItemsTable.price_list_id,
      product_id: priceListItemsTable.product_id,
      markup_percent: priceListItemsTable.markup_percent,
      product_name: productsTable.name,
      cost_price: productsTable.cost_price,
      sale_price: productsTable.sale_price,
      sku: productsTable.sku,
    })
    .from(priceListItemsTable)
    .innerJoin(productsTable, eq(priceListItemsTable.product_id, productsTable.id))
    .where(eq(priceListItemsTable.price_list_id, id));

  res.json({
    ...list,
    items: items.map(i => ({
      ...i,
      markup_percent: i.markup_percent != null ? Number(i.markup_percent) : null,
      cost_price: Number(i.cost_price ?? 0),
      sale_price: Number(i.sale_price ?? 0),
    })),
  });
}));

// ── إنشاء قائمة أسعار جديدة ───────────────────────────────────────────────
const CreatePriceListBody = z.object({
  name: z.string().min(1, "اسم القائمة مطلوب"),
  description: z.string().nullish(),
  is_active: z.boolean().optional().default(true),
  items: z.array(z.object({
    product_id: z.number(),
    markup_percent: z.number().nullish(),
  })).optional().default([]),
});

router.post("/price-lists", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_products")) {
    res.status(403).json({ error: "غير مصرح" }); return;
  }
  const parsed = CreatePriceListBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "بيانات قائمة الأسعار غير صحيحة", details: parsed.error.issues.map(i => i.message) }); return; }

  const companyId = req.user!.company_id!;
  const { name, description, is_active, items } = parsed.data;

  const [newList] = await db.insert(priceListsTable).values({
    name,
    description: description ?? null,
    is_active: is_active ?? true,
    company_id: companyId,
  }).returning();

  if (items && items.length > 0) {
    await db.insert(priceListItemsTable).values(
      items.map(item => ({
        price_list_id: newList.id,
        product_id: item.product_id,
        markup_percent: item.markup_percent != null ? String(item.markup_percent) : null,
      }))
    );
  }

  res.status(201).json(newList);
}));

// ── تعديل قائمة أسعار ─────────────────────────────────────────────────────
const UpdatePriceListBody = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullish(),
  is_active: z.boolean().optional(),
  items: z.array(z.object({
    product_id: z.number(),
    markup_percent: z.number().nullish(),
  })).optional(),
});

router.put("/price-lists/:id", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_products")) {
    res.status(403).json({ error: "غير مصرح" }); return;
  }
  const companyId = req.user!.company_id!;
  const id = Number(req.params.id);
  if (!id) throw httpError(400, "معرف القائمة غير صالح");

  const parsed = UpdatePriceListBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "بيانات قائمة الأسعار غير صحيحة", details: parsed.error.issues.map(i => i.message) }); return; }

  const [existing] = await db.select().from(priceListsTable)
    .where(and(eq(priceListsTable.id, id), eq(priceListsTable.company_id, companyId)));
  if (!existing) throw httpError(404, "القائمة غير موجودة");

  const { name, description, is_active, items } = parsed.data;
  const updateData: Partial<typeof priceListsTable.$inferInsert> = {};
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description ?? null;
  if (is_active !== undefined) updateData.is_active = is_active;

  const [updated] = await db.update(priceListsTable)
    .set(updateData)
    .where(and(eq(priceListsTable.id, id), eq(priceListsTable.company_id, companyId)))
    .returning();

  // إعادة بناء العناصر إن أُرسلت
  if (items !== undefined) {
    await db.delete(priceListItemsTable).where(eq(priceListItemsTable.price_list_id, id));
    if (items.length > 0) {
      await db.insert(priceListItemsTable).values(
        items.map(item => ({
          price_list_id: id,
          product_id: item.product_id,
          markup_percent: item.markup_percent != null ? String(item.markup_percent) : null,
        }))
      );
    }
  }

  res.json(updated);
}));

// ── حذف قائمة أسعار ───────────────────────────────────────────────────────
router.delete("/price-lists/:id", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_products")) {
    res.status(403).json({ error: "غير مصرح" }); return;
  }
  const companyId = req.user!.company_id!;
  const id = Number(req.params.id);
  if (!id) throw httpError(400, "معرف القائمة غير صالح");

  const [existing] = await db.select().from(priceListsTable)
    .where(and(eq(priceListsTable.id, id), eq(priceListsTable.company_id, companyId)));
  if (!existing) throw httpError(404, "القائمة غير موجودة");

  // إلغاء الربط من العملاء
  await db.update(customersTable)
    .set({ price_list_id: null, price_list_markup: null })
    .where(eq(customersTable.price_list_id, id));

  await db.delete(priceListsTable)
    .where(and(eq(priceListsTable.id, id), eq(priceListsTable.company_id, companyId)));

  res.json({ success: true });
}));

// ── حساب سعر منتج لعميل معين ─────────────────────────────────────────────
router.get("/price-lists/customer-price/:customer_id/:product_id", wrap(async (req, res) => {
  const companyId = getTenant(req);
  const customerId = Number(req.params.customer_id);
  const productId = Number(req.params.product_id);

  const [customer] = await db.select().from(customersTable)
    .where(and(eq(customersTable.id, customerId), eq(customersTable.company_id, companyId)));
  if (!customer) throw httpError(404, "العميل غير موجود");

  const [product] = await db.select().from(productsTable)
    .where(and(eq(productsTable.id, productId), eq(productsTable.company_id, companyId)));
  if (!product) throw httpError(404, "المنتج غير موجود");

  const defaultPrice = Number(product.sale_price ?? 0);
  const costPrice = Number(product.cost_price ?? 0);

  if (!customer.price_list_id) {
    return res.json({ price: defaultPrice, source: "default" });
  }

  // تحقق أن المنتج موجود في قائمة أسعار هذا العميل
  const [listItem] = await db.select().from(priceListItemsTable)
    .where(and(
      eq(priceListItemsTable.price_list_id, customer.price_list_id),
      eq(priceListItemsTable.product_id, productId)
    ));

  if (!listItem) {
    return res.json({ price: defaultPrice, source: "default" });
  }

  // الأولوية: markup الخاص بالعميل > markup القائمة > السعر الافتراضي
  const markupPercent = customer.price_list_markup != null
    ? Number(customer.price_list_markup)
    : (listItem.markup_percent != null ? Number(listItem.markup_percent) : null);

  if (markupPercent != null && costPrice > 0) {
    const customPrice = parseFloat((costPrice * (1 + markupPercent / 100)).toFixed(2));
    return res.json({ price: customPrice, source: "price_list", markup_percent: markupPercent });
  }

  return res.json({ price: defaultPrice, source: "default" });
}));

export default router;
