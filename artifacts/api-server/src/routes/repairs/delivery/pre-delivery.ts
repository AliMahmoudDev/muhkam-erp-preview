import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import {
  db,
  repairJobsTable,
  repairJobPartsTable,
  repairStatusHistoryTable,
  repairPaymentsTable,
  productsTable,
  stockMovementsTable,
  safesTable,
} from "@workspace/db";
import { wrap } from "../../../lib/async-handler";
import { hasPermission } from "../../../lib/permissions";
import { ctx } from "../_shared";

const router: IRouter = Router();

/**
 * (2) مراجعة ما قبل التسليم — يضع pre_delivery_reviewed_at = now().
 *
 * يستقبل (اختياري): {
 *   external_workshop, external_workshop_name, external_workshop_cost,
 *   broker_name, broker_commission
 * }
 * إرجاع القطع غير المستخدمة يتم عبر POST /parts/:partId/return بشكل منفصل
 * (المستخدم يقرر لكل قطعة على حدة قبل الضغط على "تأكيد المراجعة").
 */
router.post("/repair-jobs/:id/pre-delivery", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_repairs")) {
    return res.status(403).json({ error: "غير مصرح بمراجعة التسليم" });
  }
  const { company_id, user_id, user_name } = ctx(req);
  const id = Number(req.params.id);
  const b = req.body as Record<string, unknown>;

  const [job] = await db.select().from(repairJobsTable)
    .where(and(eq(repairJobsTable.id, id), eq(repairJobsTable.company_id, company_id)));
  if (!job) return res.status(404).json({ error: "البطاقة غير موجودة" });

  /* ── القطع المختارة (داخلية من المخزن) أو بنود إصلاح خارجي ──
     source = "internal": قطعة من المخزن (تتطلب product_id ويتم خصمها من المخزون)
     source = "external": بند إصلاح خارجي (product_id = null، مفيش حركة مخزون،
       product_name يحمل وصف الإصلاح + اسم الورشة) */
  type PartInput = {
    product_id:   number | null;
    product_name: string;
    quantity:     number;
    unit_price:   number;
    warehouse_id: number | null;
    source:       "internal" | "external";
  };
  const partsInput: PartInput[] = Array.isArray(b.parts)
    ? (b.parts as unknown[]).map((p) => {
        const o = p as Record<string, unknown>;
        const src: "internal" | "external" = o.source === "external" ? "external" : "internal";
        const pid = Number(o.product_id);
        return {
          product_id:   src === "external" ? null : (Number.isFinite(pid) && pid > 0 ? pid : null),
          product_name: String(o.product_name ?? ""),
          quantity:     Math.max(1, Number(o.quantity) || 1),
          unit_price:   Math.max(0, Number(o.unit_price) || 0),
          warehouse_id: src === "external" ? null : (o.warehouse_id ? Number(o.warehouse_id) : null),
          source:       src,
        };
      }).filter(p => p.source === "external" ? !!p.product_name.trim() : (p.product_id !== null))
    : [];

  /* ── بيانات الدفع ── */
  type PayInput = { type: "cash" | "credit"; safe_id?: number | null; amount: number };
  const paymentInfo = b.payment as Record<string, unknown> | undefined;
  const payRows: PayInput[] = Array.isArray(paymentInfo?.payments)
    ? (paymentInfo.payments as unknown[]).map((r) => {
        const o = r as Record<string, unknown>;
        return {
          type:    String(o.type ?? "cash") as "cash" | "credit",
          safe_id: o.safe_id ? Number(o.safe_id) : null,
          amount:  Math.max(0, Number(o.amount) || 0),
        };
      }).filter(r => r.amount > 0)
    : [];

  const now = new Date();

  const updated = await db.transaction(async (tx) => {
    /* ─ 1. تسجيل القطع المختارة في repair_job_parts ─ */
    for (const part of partsInput) {
      await tx.insert(repairJobPartsTable).values({
        job_id:       id,
        company_id,
        product_id:   part.product_id,
        product_name: part.product_name ?? "",
        quantity:     String(part.quantity),
        unit_price:   String(part.unit_price),
        source:       part.source,
        warehouse_id: part.warehouse_id ?? null,
        is_returned:  false,
      });

      /* البنود الخارجية لا تُخصم من المخزن */
      if (part.source === "external") continue;

      /* خصم الكمية من المخزن */
      if (part.warehouse_id && part.product_id) {
        const [prod] = await tx.select({ id: productsTable.id, quantity: productsTable.quantity })
          .from(productsTable)
          .where(and(eq(productsTable.id, part.product_id), eq(productsTable.company_id, company_id)));
        if (prod) {
          const oldQty = Number(prod.quantity);
          const newQty = Math.max(0, oldQty - part.quantity);
          await tx.update(productsTable).set({ quantity: String(newQty) })
            .where(and(eq(productsTable.id, part.product_id), eq(productsTable.company_id, company_id)));
          await tx.insert(stockMovementsTable).values({
            product_id:      part.product_id,
            product_name:    part.product_name ?? "",
            company_id,
            quantity:        String(-part.quantity),
            quantity_before: String(oldQty),
            quantity_after:  String(newQty),
            movement_type:   "repair_part",
            unit_cost:       String(part.unit_price),
            reference_id:    id,
            reference_type:  "repair_job",
            warehouse_id:    part.warehouse_id ?? null,
            notes:           `قطعة مستخدمة في بطاقة صيانة #${job.job_no}`,
            date:            now.toISOString().split("T")[0],
          });
        }
      }
    }

    /* ─ 2. تسجيل سجلات الدفع ─ */
    for (const row of payRows) {
      await tx.insert(repairPaymentsTable).values({
        job_id:         id,
        company_id,
        payment_method: row.type === "credit" ? "credit" : "cash",
        amount:         String(row.amount),
        safe_id:        row.safe_id ?? null,
        notes:          "دفعة عند مراجعة التسليم",
      });

      /* خصم المبلغ من الخزنة لو دفع نقدي */
      if (row.type === "cash" && row.safe_id) {
        await tx.update(safesTable)
          .set({ balance: sql`${safesTable.balance} + ${String(row.amount)}` })
          .where(and(eq(safesTable.id, row.safe_id), eq(safesTable.company_id, company_id)));
      }
    }

    /* ─ 3. تحديث البطاقة ─ */
    const updates: Record<string, unknown> = {
      pre_delivery_reviewed_at: now,
      updated_at: now,
    };

    /* وسيط/سمسار */
    if ("broker_name" in b || "broker_commission" in b) {
      const bName = String(b.broker_name ?? "").trim();
      updates.broker_name = bName || null;
      const bComm = Number(b.broker_commission ?? 0);
      updates.broker_commission = String(Number.isFinite(bComm) && bComm >= 0 ? bComm : 0);
    }

    const [updated] = await tx.update(repairJobsTable).set(updates)
      .where(and(eq(repairJobsTable.id, id), eq(repairJobsTable.company_id, company_id)))
      .returning();

    /* ─ 4. سجل في التاريخ ─ */
    const cashTotal   = payRows.filter(r => r.type === "cash").reduce((s, r) => s + r.amount, 0);
    const creditTotal = payRows.filter(r => r.type === "credit").reduce((s, r) => s + r.amount, 0);
    const payDesc = cashTotal > 0 && creditTotal > 0
      ? `نقدي: ${cashTotal.toFixed(2)} + آجل: ${creditTotal.toFixed(2)}`
      : cashTotal > 0 ? `نقدي: ${cashTotal.toFixed(2)}`
      : creditTotal > 0 ? `آجل: ${creditTotal.toFixed(2)}`
      : "لا يوجد دفع";
    await tx.insert(repairStatusHistoryTable).values({
      job_id: id,
      company_id,
      user_id,
      user_name,
      event_type: "pre_delivery_reviewed",
      note: `مراجعة ما قبل التسليم — ${partsInput.length} قطعة · ${payDesc}`,
    });

    return updated;
  });

  return res.json(updated);
}));

export default router;
