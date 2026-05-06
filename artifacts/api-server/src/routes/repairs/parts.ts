import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  repairJobPartsTable,
  productsTable,
  stockMovementsTable,
  scrapItemsTable,
} from "@workspace/db";
import { wrap } from "../../lib/async-handler";
import { hasPermission } from "../../lib/permissions";
import { ctx, addRepairPartSchema } from "./_shared";

const router: IRouter = Router();

/* ── PARTS ─────────────────────────────────────────────────── */
router.post("/repair-jobs/:id/parts", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_repairs")) {
    return res.status(403).json({ error: "غير مصرح بإضافة قطع الغيار" });
  }
  const { company_id } = ctx(req);
  const job_id = Number(req.params.id);
  const vp = addRepairPartSchema.safeParse(req.body);
  if (!vp.success) return res.status(400).json({ error: vp.error.errors[0]?.message ?? "بيانات غير صالحة" });
  const { product_name, product_id, quantity, unit_price, source, warehouse_id } = vp.data;
  const [part] = await db.insert(repairJobPartsTable).values({
    job_id,
    company_id,
    product_id:    product_id ?? null,
    product_name,
    quantity:      String(quantity),
    unit_price:    String(unit_price),
    source,
    warehouse_id:  warehouse_id ?? null,
  }).returning();
  return res.status(201).json(part);
}));

router.delete("/repair-jobs/:id/parts/:partId", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_repairs")) {
    return res.status(403).json({ error: "غير مصرح بحذف قطع الغيار" });
  }
  const { company_id } = ctx(req);
  const partId = Number(req.params.partId);
  await db.delete(repairJobPartsTable)
    .where(and(eq(repairJobPartsTable.id, partId), eq(repairJobPartsTable.company_id, company_id)));
  return res.json({ ok: true });
}));

/**
 * إرجاع قطعة غيار من بطاقة صيانة إلى المخزن أو إلى سجل الهالك (Scrap).
 *
 * - destination = "stock"  → يزيد كمية المنتج في productsTable + يسجل stock_movement (نوع: repair_return)
 * - destination = "scrap"  → يضيف القطعة إلى scrap_items (لا يعود للمخزون)
 *
 * تطبيق ذرّي عبر transaction لمنع تعارض ما بين تحديث الجدول والمخزن.
 */
router.post("/repair-jobs/:id/parts/:partId/return", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_repairs")) {
    return res.status(403).json({ error: "غير مصرح بإرجاع قطع الغيار" });
  }
  const { company_id, user_id, user_name } = ctx(req);
  const partId = Number(req.params.partId);
  const b = req.body as Record<string, unknown>;
  const dest = String(b.destination ?? "stock"); // 'stock' | 'scrap'
  if (dest !== "stock" && dest !== "scrap") {
    return res.status(400).json({ error: "وجهة الإرجاع يجب أن تكون stock أو scrap" });
  }

  /* خطأ HTTP محمول داخل المعاملة — نُرميه لإلغاء المعاملة ثم نمسكه ليعطي status معبّر */
  class HttpAbort extends Error {
    constructor(public httpStatus: number, public reason: string) { super(reason); }
  }

  try {
    await db.transaction(async (tx) => {
      /* RACE-FIX: claim atomically — نحدّث القطعة فقط لو لم تُرجَع بعد، ونعيدها كـ returning. */
      const [claimed] = await tx.update(repairJobPartsTable)
        .set({
          is_returned: true,
          return_destination: dest,
          returned_at: new Date(),
        })
        .where(and(
          eq(repairJobPartsTable.id, partId),
          eq(repairJobPartsTable.company_id, company_id),
          eq(repairJobPartsTable.is_returned, false),
        ))
        .returning();

      if (!claimed) {
        /* إمّا غير موجودة أو سُبقت بإرجاع آخر — تحقّق سبب الفشل */
        const [check] = await tx.select({ id: repairJobPartsTable.id })
          .from(repairJobPartsTable)
          .where(and(eq(repairJobPartsTable.id, partId), eq(repairJobPartsTable.company_id, company_id)));
        if (!check) throw new HttpAbort(404, "القطعة غير موجودة");
        throw new HttpAbort(400, "تم إرجاعها بالفعل");
      }

      const part = claimed;

      if (dest === "stock" && part.product_id && part.warehouse_id) {
        /* زيادة كمية المنتج في المخزن المحدد */
        const [prod] = await tx.select({ id: productsTable.id, quantity: productsTable.quantity, name: productsTable.name })
          .from(productsTable)
          .where(and(eq(productsTable.id, part.product_id), eq(productsTable.company_id, company_id)));
        if (!prod) throw new HttpAbort(404, "المنتج المرتبط لم يعد موجوداً");

        const oldQty = Number(prod.quantity);
        const addQty = Number(part.quantity);
        const newQty = oldQty + addQty;

        await tx.update(productsTable)
          .set({ quantity: String(newQty) })
          .where(and(eq(productsTable.id, part.product_id), eq(productsTable.company_id, company_id)));

        await tx.insert(stockMovementsTable).values({
          product_id:      part.product_id,
          product_name:    part.product_name,
          movement_type:   "repair_return",
          quantity:        String(addQty),         // موجب = وارد
          quantity_before: String(oldQty),
          quantity_after:  String(newQty),
          unit_cost:       part.unit_price,
          reference_type:  "repair_job",
          reference_id:    part.job_id,
          notes:           `إرجاع قطعة غير مستخدمة من بطاقة صيانة #${part.job_id}`,
          date:            new Date().toISOString().split("T")[0],
          warehouse_id:    part.warehouse_id,
          company_id,
        });
      }

      if (dest === "scrap") {
        await tx.insert(scrapItemsTable).values({
          company_id,
          product_id: part.product_id,
          product_name: part.product_name,
          quantity: part.quantity,
          unit_cost: part.unit_price,
          warehouse_id: part.warehouse_id,
          reason: String(b.reason ?? "إرجاع من صيانة - تالفة"),
          source_type: "repair_return",
          source_id: part.job_id,
          created_by: user_id,
          created_by_name: user_name,
        });
      }
    });
  } catch (err) {
    if (err instanceof HttpAbort) return res.status(err.httpStatus).json({ error: err.reason });
    throw err;
  }

  return res.json({ ok: true });
}));

export default router;
