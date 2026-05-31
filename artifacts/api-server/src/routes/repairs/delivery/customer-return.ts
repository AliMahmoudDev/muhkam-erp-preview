import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import {
  db,
  repairJobsTable,
  repairJobPartsTable,
  repairStatusHistoryTable,
  productsTable,
  stockMovementsTable,
  safesTable,
  transactionsTable,
  scrapItemsTable,
} from "@workspace/db";
import { wrap } from "../../../lib/async-handler";
import { hasPermission } from "../../../lib/permissions";
import { ctx } from "../_shared";

const router: IRouter = Router();

/* ══════════════════════════════════════════════════════════════
   CUSTOMER RETURN — مرتجع عميل بعد التسليم + استرداد المبلغ
══════════════════════════════════════════════════════════════ */

/**
 * POST /repair-jobs/:id/customer-return
 *
 * يُسجّل مرتجع عميل على بطاقة مُسلَّمة:
 * - يُحدّث is_customer_returned = true + customer_return_amount
 * - لكل قطعة في body.parts: يُرجعها للمخزن أو يُسجّلها توالف (نفس منطق parts/:partId/return)
 * - يُنشئ معاملة مالية للاسترداد إن كان refund_amount > 0
 * - يُسجّل حدث في status_history
 *
 * Body: {
 *   refund_amount: number,
 *   problem_description?: string,
 *   notes?: string,
 *   parts: Array<{ part_id: number, destination: 'stock' | 'scrap' }>
 * }
 */
router.post("/repair-jobs/:id/customer-return", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_repairs")) {
    return res.status(403).json({ error: "غير مصرح بتسجيل مرتجع صيانة" });
  }
  const { company_id, user_id, user_name } = ctx(req);
  const jobId = Number(req.params.id);
  const b = req.body as Record<string, unknown>;

  const refundAmount = Number(b.refund_amount ?? 0);
  const partsDisposition = Array.isArray(b.parts)
    ? (b.parts as Array<{ part_id: number; destination: string }>)
    : [];

  if (!Number.isFinite(refundAmount) || refundAmount < 0) {
    return res.status(400).json({ error: "المبلغ المسترد غير صحيح" });
  }

  /* عند وجود مبلغ مسترد > 0 يجب اختيار خزنة لخصمه منها */
  const refundSafeId = refundAmount > 0 ? Number(b.safe_id) : null;
  if (refundAmount > 0 && (!Number.isFinite(refundSafeId) || (refundSafeId ?? 0) <= 0)) {
    return res.status(400).json({ error: "يجب اختيار خزنة لخصم المبلغ المسترد منها" });
  }

  class HttpAbort extends Error {
    constructor(public httpStatus: number, public reason: string) { super(reason); }
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [job] = await tx.select().from(repairJobsTable)
        .where(and(eq(repairJobsTable.id, jobId), eq(repairJobsTable.company_id, company_id)));

      if (!job) throw new HttpAbort(404, "بطاقة الصيانة غير موجودة");
      if (job.status !== "delivered") throw new HttpAbort(400, "لا يمكن تسجيل مرتجع إلا على بطاقة مُسلَّمة");
      if (job.is_customer_returned) throw new HttpAbort(400, "تم تسجيل مرتجع على هذه البطاقة مسبقاً");

      /* تحديث البطاقة */
      await tx.update(repairJobsTable).set({
        is_customer_returned:   true,
        customer_return_amount: String(refundAmount),
        updated_at:             new Date(),
      }).where(and(eq(repairJobsTable.id, jobId), eq(repairJobsTable.company_id, company_id)));

      /* معالجة القطع */
      for (const item of partsDisposition) {
        const dest = item.destination === "scrap" ? "scrap" : "stock";

        const [claimed] = await tx.update(repairJobPartsTable)
          .set({ is_returned: true, return_destination: dest, returned_at: new Date() })
          .where(and(
            eq(repairJobPartsTable.id, item.part_id),
            eq(repairJobPartsTable.company_id, company_id),
            eq(repairJobPartsTable.is_returned, false),
          ))
          .returning();

        if (!claimed) continue; /* مُرجعت مسبقاً أو غير موجودة — تخطّ */

        if (dest === "stock" && claimed.product_id && claimed.warehouse_id) {
          const [prod] = await tx.select({ id: productsTable.id, quantity: productsTable.quantity })
            .from(productsTable)
            .where(and(eq(productsTable.id, claimed.product_id), eq(productsTable.company_id, company_id)));

          if (prod) {
            const oldQty = Number(prod.quantity);
            const addQty = Number(claimed.quantity);
            const newQty = oldQty + addQty;

            await tx.update(productsTable)
              .set({ quantity: String(newQty) })
              .where(and(eq(productsTable.id, claimed.product_id), eq(productsTable.company_id, company_id)));

            await tx.insert(stockMovementsTable).values({
              product_id:      claimed.product_id,
              product_name:    claimed.product_name,
              movement_type:   "repair_return",
              quantity:        String(addQty),
              quantity_before: String(oldQty),
              quantity_after:  String(newQty),
              unit_cost:       claimed.unit_price,
              reference_type:  "repair_job",
              reference_id:    jobId,
              notes:           `إرجاع قطعة (مرتجع عميل) من بطاقة صيانة #${job.job_no}`,
              date:            new Date().toISOString().split("T")[0],
              warehouse_id:    claimed.warehouse_id,
              company_id,
            });
          }
        }

        if (dest === "scrap") {
          await tx.insert(scrapItemsTable).values({
            company_id,
            product_id:    claimed.product_id ?? undefined,
            product_name:  claimed.product_name,
            quantity:      claimed.quantity,
            unit_cost:     claimed.unit_price,
            warehouse_id:  claimed.warehouse_id ?? undefined,
            reason:        `مرتجع عميل — بطاقة صيانة ${job.job_no}`,
            source_type:   "repair_return",
            source_id:     jobId,
            created_by:    user_id,
            created_by_name: user_name,
          });
        }
      }

      /* معاملة مالية للاسترداد — خصم ذرّي من الخزنة المختارة */
      if (refundAmount > 0 && refundSafeId) {
        const [safe] = await tx.select().from(safesTable)
          .where(and(eq(safesTable.id, refundSafeId), eq(safesTable.company_id, company_id)));
        if (!safe) throw new HttpAbort(404, "الخزنة غير موجودة");

        const debited = await tx.update(safesTable)
          .set({ balance: sql`${safesTable.balance} - ${String(refundAmount)}` })
          .where(and(
            eq(safesTable.id, refundSafeId),
            eq(safesTable.company_id, company_id),
            sql`${safesTable.balance} >= ${String(refundAmount)}`,
          ))
          .returning({ id: safesTable.id });
        if (debited.length === 0) {
          throw new HttpAbort(400, `رصيد الخزنة غير كافٍ (المتاح: ${Number(safe.balance).toFixed(2)})`);
        }

        await tx.insert(transactionsTable).values({
          company_id,
          type:           "expense",
          amount:         String(refundAmount),
          description:    `استرداد مبلغ مرتجع صيانة — ${job.job_no}`,
          reference_type: "repair_return",
          reference_id:   jobId,
          safe_id:        refundSafeId,
        });
      }

      /* سجل في التاريخ */
      await tx.insert(repairStatusHistoryTable).values({
        job_id:      jobId,
        company_id,
        status_from: "delivered",
        status_to:   "delivered",
        user_id,
        user_name,
        event_type:  "customer_return",
        note:        `مرتجع عميل — استرداد ${refundAmount} — ${b.problem_description ?? ""}`.trim(),
      });

      return { ok: true };
    });

    return res.json(result);
  } catch (err) {
    const e = err as { httpStatus?: number; reason?: string; message?: string };
    if (e.httpStatus) return res.status(e.httpStatus).json({ error: e.reason });
    throw err;
  }
}));

export default router;
