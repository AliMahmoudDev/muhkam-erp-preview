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
  expensesTable,
  expenseCategoriesTable,
  safesTable,
  transactionsTable,
  scrapItemsTable,
} from "@workspace/db";
import { wrap } from "../../lib/async-handler";
import { hasPermission } from "../../lib/permissions";
import { logger } from "../../lib/logger";
import { getOrCreateSafeAccount, getOrCreateGeneralExpenseAccount, createAutoJournalEntry } from "../../lib/auto-account";
import { ctx } from "./_shared";

const router: IRouter = Router();

/* ══════════════════════════════════════════════════════════════
   WARRANTY — إنشاء بطاقة ضمان مرتبطة ببطاقة مُسلَّمة
══════════════════════════════════════════════════════════════ */

/**
 * POST /repair-jobs/:id/create-warranty
 *
 * ينشئ بطاقة صيانة جديدة من نوع "warranty" مرتبطة بالبطاقة الأصلية.
 * - البطاقة الأصلية يجب أن تكون في حالة "delivered" وليست ضمان نفسها.
 * - يأخذ بيانات العميل والجهاز من الأصل تلقائياً.
 * - رقم البطاقة الجديدة: {parent_job_no}/W{n}
 */
router.post("/repair-jobs/:id/create-warranty", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_repairs")) {
    return res.status(403).json({ error: "غير مصرح بإنشاء بطاقة ضمان" });
  }
  const { company_id, user_id, user_name } = ctx(req);
  const parentId = Number(req.params.id);
  const b = req.body as Record<string, unknown>;

  const [parent] = await db.select().from(repairJobsTable)
    .where(and(eq(repairJobsTable.id, parentId), eq(repairJobsTable.company_id, company_id)));

  if (!parent) return res.status(404).json({ error: "بطاقة الصيانة غير موجودة" });
  if (parent.status !== "delivered") return res.status(400).json({ error: "لا يمكن فتح ضمان إلا على بطاقة مُسلَّمة" });
  if (parent.job_type === "warranty") return res.status(400).json({ error: "لا يمكن فتح ضمان على بطاقة ضمان" });

  /* حساب رقم الضمان: {parent_job_no}/W1, W2, ... */
  const siblings = await db.select({ id: repairJobsTable.id })
    .from(repairJobsTable)
    .where(and(
      eq(repairJobsTable.company_id, company_id),
      eq(repairJobsTable.warranty_of, parentId),
    ));
  const warrantyNo = `${parent.job_no}/W${siblings.length + 1}`;

  const today = new Date().toISOString().split("T")[0];

  const [newJob] = await db.insert(repairJobsTable).values({
    company_id,
    job_no:                warrantyNo,
    job_type:              "warranty",
    warranty_of:           parentId,
    customer_name:         parent.customer_name,
    customer_phone:        parent.customer_phone,
    customer_id:           parent.customer_id,
    device_brand:          parent.device_brand,
    device_model:          parent.device_model,
    device_type:           parent.device_type,
    imei:                  parent.imei,
    serial_no:             parent.serial_no,
    color:                 parent.color,
    storage:               parent.storage,
    problem_description:   b.problem_description ? String(b.problem_description) : null,
    notes:                 b.notes ? String(b.notes) : null,
    status:                "received",
    received_at:           today,
    estimated_cost:        "0",
    final_cost:            "0",
    deposit_paid:          "0",
  }).returning();

  /* سجّل في تاريخ البطاقة الجديدة */
  await db.insert(repairStatusHistoryTable).values({
    job_id:       newJob.id,
    company_id,
    status_from:  null,
    status_to:    "received",
    user_id,
    user_name,
    event_type:   "warranty_created",
    note:         `بطاقة ضمان مرتبطة بـ ${parent.job_no}`,
  });

  /* سجّل في تاريخ البطاقة الأصل */
  await db.insert(repairStatusHistoryTable).values({
    job_id:       parentId,
    company_id,
    status_from:  "delivered",
    status_to:    "delivered",
    user_id,
    user_name,
    event_type:   "warranty_opened",
    note:         `فُتح طلب ضمان: ${warrantyNo}`,
  });

  return res.status(201).json(newJob);
}));

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

/* ══════════════════════════════════════════════════════════════
   STAGE-GATE ENDPOINTS — Modals مخصّصة لكل بوّابة في Pipeline
   هذه الـ endpoints تَملأ الحقول المطلوبة (timestamps) التي
   تتحقق منها validateTransition في الانتقال التالي.
══════════════════════════════════════════════════════════════ */

/**
 * (1) إكمال فحص مراقبة الجودة (QC) قبل "جاهز للتسليم".
 *
 * يستقبل: { items: [...], notes?, device_score? }
 * يُسجّل: qa_checklist (JSON) + qa_completed_at + qa_notes + device_score
 * يحفظ سطر في status_history (event_type='qa_completed') لتتبع الفنّي الذي أنجز الفحص.
 */
router.post("/repair-jobs/:id/qa-checklist", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_repairs")) {
    return res.status(403).json({ error: "غير مصرح بإكمال فحص الجودة" });
  }
  const { company_id, user_id, user_name } = ctx(req);
  const id = Number(req.params.id);
  const b = req.body as Record<string, unknown>;

  const items = Array.isArray(b.items) ? b.items : [];
  /* حين لا يوجد فحص أولي مسجّل عند الاستلام (checklist = null)، تُرسل بنود فارغة
     مع علم no_intake_checklist=true — نقبلها ونضبط qa_completed_at لإتمام المرحلة */
  const noIntakeChecklist = b.no_intake_checklist === true;

  if (items.length === 0 && !noIntakeChecklist) {
    return res.status(400).json({ error: "يجب إدخال بنود فحص QC" });
  }

  if (items.length > 0) {
    /* كل بند يجب أن يحوي status (pass/fail/n/a) */
    const allDecided = items.every((i: unknown) => {
      const it = i as { status?: unknown };
      return it.status === "pass" || it.status === "fail" || it.status === "n/a";
    });
    if (!allDecided) {
      return res.status(400).json({ error: "يجب اتخاذ قرار (نجح/فشل/لا ينطبق) لكل بند فحص" });
    }

    /* SEC-GATE-003: قبول QC على مستوى الخادم يعني "اجتياز الفحص"؛ لذلك لا نسمح
       بضبط qa_completed_at إن وُجد أي بند فاشل. الواجهة تمنع ذلك ولكن نُحصّن
       الخادم ضد طلبات API مباشرة قد تتجاوز التحقق العميل. الفنّي عند فشل أي بند
       يجب أن يستخدم مسار "رفض QC" (PATCH qa_notes) بدلاً من القبول. */
    const failedCount = items.filter((i: unknown) => {
      const it = i as { status?: unknown };
      return it.status === "fail";
    }).length;
    if (failedCount > 0) {
      return res.status(400).json({
        error: `لا يمكن قبول الفحص ووجود ${failedCount} بند فاشل — استخدم "رفض الفحص" لإعادة البطاقة للإصلاح مع كتابة السبب`,
      });
    }
  }

  const [job] = await db.select().from(repairJobsTable)
    .where(and(eq(repairJobsTable.id, id), eq(repairJobsTable.company_id, company_id)));
  if (!job) return res.status(404).json({ error: "البطاقة غير موجودة" });

  const updates: Record<string, unknown> = {
    qa_checklist: JSON.stringify(items),
    qa_completed_at: new Date(),
    qa_notes: b.notes != null ? String(b.notes) : job.qa_notes,
    updated_at: new Date(),
  };
  if (b.device_score != null && String(b.device_score).trim() !== "") {
    const score = Number(b.device_score);
    if (Number.isFinite(score) && score >= 0 && score <= 100) {
      updates.device_score = score;
    }
  }

  const [updated] = await db.update(repairJobsTable).set(updates)
    .where(and(eq(repairJobsTable.id, id), eq(repairJobsTable.company_id, company_id)))
    .returning();

  await db.insert(repairStatusHistoryTable).values({
    job_id: id,
    company_id,
    user_id,
    user_name,
    event_type: "qa_completed",
    note: `إكمال فحص مراقبة الجودة — ${items.filter((i: { status?: string }) => i.status === "fail").length} بند فشل`,
  });

  return res.json(updated);
}));

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
    ? (paymentInfo!.payments as unknown[]).map((r) => {
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

/**
 * (3) تسجيل تكلفة الشحن — تنشئ مصروفاً تلقائياً وتخصمه من الخزنة المختارة.
 *
 * يستقبل: { shipping_cost: number, safe_id: number, notes? }
 * - يُنشئ سطر مصروف في expenses (الفئة: "مصاريف شحن صيانة" — تُستحدَث تلقائياً إن لم تكن موجودة)
 * - يُخصَم المبلغ من رصيد الخزنة (safe) بشكل ذرّي
 * - يُسجَّل سطر في transactions + journal entry + يُربط expense.id بالبطاقة (shipping_expense_id)
 * - في النهاية يضع shipping_settled_at = now() لفتح بوابة الانتقال إلى "تم التسليم".
 *
 * إن كانت تكلفة الشحن = 0 يمكن للمستخدم تأكيد ذلك (يضع shipping_settled_at بدون مصروف).
 */
router.post("/repair-jobs/:id/shipping", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_repairs")) {
    return res.status(403).json({ error: "غير مصرح بتسجيل تكلفة الشحن" });
  }
  const { company_id, user_id, user_name } = ctx(req);
  const id = Number(req.params.id);
  const b = req.body as Record<string, unknown>;

  const cost = Number(b.shipping_cost ?? 0);
  if (!Number.isFinite(cost) || cost < 0) {
    return res.status(400).json({ error: "تكلفة الشحن غير صحيحة" });
  }

  const discount = Number(b.final_discount ?? 0);
  if (!Number.isFinite(discount) || discount < 0) {
    return res.status(400).json({ error: "قيمة الخصم غير صحيحة" });
  }

  /* حفظ مسودة فقط — بدون محاسبة وبدون تغيير الحالة */
  if (b.save_only === true) {
    const [saved] = await db.update(repairJobsTable).set({
      shipping_cost:  String(cost),
      final_discount: String(discount),
      updated_at:     new Date(),
    }).where(and(
      eq(repairJobsTable.id, id),
      eq(repairJobsTable.company_id, company_id),
    )).returning();
    if (!saved) return res.status(404).json({ error: "البطاقة غير موجودة" });
    return res.json({ job: saved, saved_only: true });
  }

  const [job] = await db.select().from(repairJobsTable)
    .where(and(eq(repairJobsTable.id, id), eq(repairJobsTable.company_id, company_id)));
  if (!job) return res.status(404).json({ error: "البطاقة غير موجودة" });
  if (job.shipping_settled_at) {
    return res.status(400).json({ error: "تكلفة الشحن مسجّلة مسبقاً لهذه البطاقة" });
  }

  /* حالة 1: المستخدم أكّد عدم وجود تكلفة شحن
     IDEMPOTENCY: الـ WHERE يضمن أنه لو طلبان متزامنان أرسلا shipping=0
     فسطر واحد فقط هو الذي سيُحدّث، والثاني سيرجع بدون updated rows. */
  if (cost === 0) {
    const [updated] = await db.update(repairJobsTable).set({
      shipping_cost: "0",
      final_discount: String(discount),
      shipping_settled_at: new Date(),
      updated_at: new Date(),
    }).where(and(
      eq(repairJobsTable.id, id),
      eq(repairJobsTable.company_id, company_id),
      sql`${repairJobsTable.shipping_settled_at} IS NULL`,
    )).returning();

    if (!updated) return res.status(409).json({ error: "تكلفة الشحن مسجّلة مسبقاً (تنفيذ متزامن)" });

    await db.insert(repairStatusHistoryTable).values({
      job_id: id,
      company_id,
      user_id,
      user_name,
      event_type: "shipping_settled",
      note: "تم تأكيد عدم وجود تكلفة شحن",
    });

    return res.json({ job: updated, expense: null });
  }

  /* حالة 2: تكلفة شحن > 0 — ننشئ مصروف فعلي */
  const safeId = Number(b.safe_id);
  if (!Number.isFinite(safeId) || safeId <= 0) {
    return res.status(400).json({ error: "يجب اختيار خزنة لخصم تكلفة الشحن منها" });
  }

  /* خطأ HTTP محمول داخل المعاملة لإلغائها بأمان */
  class HttpAbort extends Error {
    constructor(public httpStatus: number, public reason: string) { super(reason); }
  }

  let txResult: { job: typeof job; expense: { id: number }; safeName: string; note: string } | null = null;

  try {
    txResult = await db.transaction(async (tx) => {
      /* IDEMPOTENCY-FIX: claim الـ shipping_settled_at ذرّياً قبل أي تعديل آخر —
         إن سبقنا طلب آخر فالـ UPDATE لن يُرجع أي صف، ونوقف العملية. */
      const [claimedJob] = await tx.update(repairJobsTable).set({
        shipping_settled_at: new Date(),
        updated_at: new Date(),
      }).where(and(
        eq(repairJobsTable.id, id),
        eq(repairJobsTable.company_id, company_id),
        sql`${repairJobsTable.shipping_settled_at} IS NULL`,
      )).returning();

      if (!claimedJob) throw new HttpAbort(409, "تكلفة الشحن مسجّلة مسبقاً (تنفيذ متزامن)");

      /* جلب الخزنة وخصم المبلغ ذرّياً */
      const [safe] = await tx.select().from(safesTable)
        .where(and(eq(safesTable.id, safeId), eq(safesTable.company_id, company_id)));
      if (!safe) throw new HttpAbort(404, "الخزنة غير موجودة");

      const debited = await tx.update(safesTable)
        .set({ balance: sql`${safesTable.balance} - ${String(cost)}` })
        .where(and(
          eq(safesTable.id, safeId),
          eq(safesTable.company_id, company_id),
          sql`${safesTable.balance} >= ${String(cost)}`,
        ))
        .returning({ id: safesTable.id });
      if (debited.length === 0) {
        throw new HttpAbort(400, `رصيد الخزنة غير كافٍ (المتاح: ${Number(safe.balance).toFixed(2)})`);
      }

      /* فئة المصروف — استحداث "مصاريف شحن صيانة" إن لم تكن موجودة */
      const SHIPPING_CAT_NAME = "مصاريف شحن صيانة";
      let [shipCat] = await tx.select().from(expenseCategoriesTable)
        .where(and(eq(expenseCategoriesTable.name, SHIPPING_CAT_NAME), eq(expenseCategoriesTable.company_id, company_id)));
      if (!shipCat) {
        const [created] = await tx.insert(expenseCategoriesTable).values({
          name: SHIPPING_CAT_NAME,
          company_id,
        }).returning();
        shipCat = created;
      }

      /* إدراج المصروف */
      const note = String(b.notes ?? `شحن بطاقة صيانة ${job.job_no}`);
      const [exp] = await tx.insert(expensesTable).values({
        description:    note,
        amount:         String(cost),
        category:       SHIPPING_CAT_NAME,
        safe_id:        safeId,
        safe_name:      safe.name,
        reference_type: "repair_job",
        reference_id:   id,
        company_id,
      }).returning();

      /* سطر في transactions */
      await tx.insert(transactionsTable).values({
        type: "expense",
        amount: String(cost),
        description: note,
        reference_type: "repair_shipping",
        reference_id: id,
        safe_id: safeId,
        company_id,
      });

      /* تحديث البطاقة بـ shipping_cost + خصم نهائي + رابط المصروف (settled_at تم claim'ه أعلاه) */
      const [updated] = await tx.update(repairJobsTable).set({
        shipping_cost:        String(cost),
        final_discount:       String(discount),
        shipping_expense_id:  exp.id,
      }).where(and(eq(repairJobsTable.id, id), eq(repairJobsTable.company_id, company_id))).returning();

      await tx.insert(repairStatusHistoryTable).values({
        job_id: id,
        company_id,
        user_id,
        user_name,
        event_type: "shipping_settled",
        note: `تكلفة شحن ${cost.toFixed(2)} — مصروف #${exp.id}`,
      });

      return { job: updated, expense: exp, safeName: safe.name, note };
    });
  } catch (err) {
    if (err instanceof HttpAbort) return res.status(err.httpStatus).json({ error: err.reason });
    throw err;
  }

  /* القيد المحاسبي خارج المعاملة (دوال auto-account لا تقبل tx).
     ملاحظة: نُنفّذه بعد commit ضماناً للاتساق المحاسبي —
     لو فشل هنا تظل بيانات الشحن صحيحة ويتم تسجيل الخطأ ليُعالَج لاحقاً. */
  if (txResult) {
    try {
      const expenseAcct = await getOrCreateGeneralExpenseAccount(company_id);
      const safeAcct    = await getOrCreateSafeAccount(safeId, txResult.safeName, company_id);
      await createAutoJournalEntry({
        date:        new Date().toISOString().split("T")[0],
        description: txResult.note,
        reference:   `repair_shipping:${id}`,
        debit:       expenseAcct,
        credit:      safeAcct,
        amount:      cost,
        companyId:   company_id,
      });
    } catch (jErr) {
      logger.error({ jobId: id, err: jErr }, "[repair-shipping] auto-journal failed");
    }
  }

  return res.json({ job: txResult?.job, expense: txResult?.expense });
}));

/**
 * (4) بيانات إيصال التسليم — للطباعة و WhatsApp.
 *
 * يُرجع البيانات المنسّقة (بدون HTML) ليبنيها العميل (frontend) كما يشاء —
 * هذا أوضح فصلاً للمسؤوليات وأسهل اختباراً من إرجاع HTML من الخادم.
 */
router.get("/repair-jobs/:id/receipt-data", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_repairs")) {
    return res.status(403).json({ error: "غير مصرح بعرض بيانات الإيصال" });
  }
  const { company_id } = ctx(req);
  const id = Number(req.params.id);

  const [job] = await db.select().from(repairJobsTable)
    .where(and(eq(repairJobsTable.id, id), eq(repairJobsTable.company_id, company_id)));
  if (!job) return res.status(404).json({ error: "البطاقة غير موجودة" });

  const parts = await db.select().from(repairJobPartsTable)
    .where(and(eq(repairJobPartsTable.job_id, id), eq(repairJobPartsTable.company_id, company_id)));

  const partsTotal = parts.reduce((sum, p) => sum + (Number(p.quantity) * Number(p.unit_price)), 0);

  return res.json({
    job_no:           job.job_no,
    customer_name:    job.customer_name,
    customer_phone:   job.customer_phone,
    device_brand:     job.device_brand,
    device_model:     job.device_model,
    imei:             job.imei,
    serial_no:        job.serial_no,
    color:            job.color,
    storage:          job.storage,
    received_at:      job.received_at,
    delivered_at:     job.delivered_at,
    problem_description: job.problem_description,
    notes:            job.notes,
    technician_name:  job.technician_name,
    estimated_cost:   Number(job.estimated_cost ?? 0),
    final_cost:       Number(job.final_cost ?? 0),
    deposit_paid:     Number(job.deposit_paid ?? 0),
    shipping_cost:    Number(job.shipping_cost ?? 0),
    final_discount:   Number(job.final_discount ?? 0),
    parts_total:      partsTotal,
    parts:            parts.map((p) => ({
      product_name: p.product_name,
      quantity:     Number(p.quantity),
      unit_price:   Number(p.unit_price),
      total:        Number(p.quantity) * Number(p.unit_price),
    })),
    qa_completed_at:  job.qa_completed_at,
    delivery_receipt_sent_at: job.delivery_receipt_sent_at,
  });
}));

/**
 * (5) تسجيل أن إيصال التسليم قد أُرسل / طُبع.
 * يستقبل: { method: 'whatsapp' | 'print' | 'both' }
 */
router.post("/repair-jobs/:id/delivery-receipt", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_repairs")) {
    return res.status(403).json({ error: "غير مصرح بتسجيل إيصال التسليم" });
  }
  const { company_id, user_id, user_name } = ctx(req);
  const id = Number(req.params.id);
  const b = req.body as Record<string, unknown>;

  const method = String(b.method ?? "both");
  if (!["whatsapp", "print", "both"].includes(method)) {
    return res.status(400).json({ error: "طريقة الإرسال غير صحيحة" });
  }

  const [updated] = await db.update(repairJobsTable).set({
    delivery_receipt_sent_at: new Date(),
    delivery_receipt_method:  method,
    updated_at:               new Date(),
  })
    .where(and(eq(repairJobsTable.id, id), eq(repairJobsTable.company_id, company_id)))
    .returning();
  if (!updated) return res.status(404).json({ error: "البطاقة غير موجودة" });

  await db.insert(repairStatusHistoryTable).values({
    job_id: id,
    company_id,
    user_id,
    user_name,
    event_type: "delivery_receipt_sent",
    note: `تم إرسال/طباعة إيصال التسليم — ${method === "whatsapp" ? "واتساب" : method === "print" ? "طباعة" : "واتساب + طباعة"}`,
  });

  return res.json(updated);
}));

/* ══════════════════════════════════════════════════════════════
   DELIVERY PAYMENT — تسجيل طريقة الدفع عند التسليم
══════════════════════════════════════════════════════════════ */

/**
 * POST /repair-jobs/:id/delivery-payment
 *
 * يُسجّل طريقة الدفع عند تسليم الجهاز:
 * - cash / instant_transfer: يُضاف المبلغ المتبقي إلى الخزنة المختارة
 * - deferred: يُنشئ ذمّة مدينة (لا يُعدّل رصيد الخزنة)
 *
 * Body: { payment_type: 'cash'|'deferred'|'instant_transfer', safe_id?: number }
 */
router.post("/repair-jobs/:id/delivery-payment", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_repairs")) {
    return res.status(403).json({ error: "غير مصرح بتسجيل دفعات التسليم" });
  }
  const { company_id, user_id, user_name } = ctx(req);
  const id = Number(req.params.id);
  const b = req.body as Record<string, unknown>;

  const paymentType = String(b.payment_type ?? "").trim();
  if (!["cash", "deferred", "instant_transfer"].includes(paymentType)) {
    return res.status(400).json({ error: "نوع الدفع غير صحيح — يجب أن يكون: cash أو deferred أو instant_transfer" });
  }

  const safeId = b.safe_id ? Number(b.safe_id) : null;
  if ((paymentType === "cash" || paymentType === "instant_transfer") && (!safeId || safeId <= 0)) {
    return res.status(400).json({ error: "يجب اختيار خزنة عند الدفع النقدي أو التحويل الفوري" });
  }

  const [job] = await db.select().from(repairJobsTable)
    .where(and(eq(repairJobsTable.id, id), eq(repairJobsTable.company_id, company_id)));
  if (!job) return res.status(404).json({ error: "البطاقة غير موجودة" });

  /* حساب المتبقي */
  const finalCost = Number(job.final_cost ?? 0);
  const depositPaid = Number(job.deposit_paid ?? 0);
  const shipping = Number(job.shipping_cost ?? 0);
  const discount = Number(job.final_discount ?? 0);
  const totalDue = finalCost + shipping - discount;
  const remaining = Math.max(0, totalDue - depositPaid);

  const updated = await db.transaction(async (tx) => {
    /* تسجيل نوع الدفع والخزنة في البطاقة */
    const [upd] = await tx.update(repairJobsTable).set({
      delivery_payment_type: paymentType,
      delivery_safe_id: safeId,
      updated_at: new Date(),
    }).where(and(eq(repairJobsTable.id, id), eq(repairJobsTable.company_id, company_id)))
      .returning();

    /* إذا كان الدفع نقدي أو تحويل فوري والمتبقي > 0: أضف للخزنة */
    if ((paymentType === "cash" || paymentType === "instant_transfer") && remaining > 0 && safeId) {
      await tx.update(safesTable)
        .set({ balance: sql`${safesTable.balance} + ${String(remaining)}` })
        .where(and(eq(safesTable.id, safeId), eq(safesTable.company_id, company_id)));

      await tx.insert(transactionsTable).values({
        type: "repair_payment",
        reference_type: "repair_delivery",
        reference_id: id,
        safe_id: safeId,
        amount: String(remaining),
        direction: "in",
        description: `دفعة تسليم صيانة — بطاقة ${job.job_no} (${paymentType === "cash" ? "نقدي" : "تحويل فوري"})`,
        date: new Date().toISOString().split("T")[0]!,
        company_id,
      });

      /* تحديث deposit_paid */
      await tx.update(repairJobsTable).set({
        deposit_paid: String(depositPaid + remaining),
      }).where(eq(repairJobsTable.id, id));
    }

    /* سجل في التاريخ */
    const typeLabel = paymentType === "cash" ? "نقدي" : paymentType === "instant_transfer" ? "تحويل فوري" : "آجل";
    await tx.insert(repairStatusHistoryTable).values({
      job_id: id,
      company_id,
      user_id,
      user_name,
      event_type: "delivery_payment",
      note: `تسجيل دفعة تسليم: ${typeLabel}${remaining > 0 ? ` — ${remaining.toFixed(2)}` : ""}`,
    });

    return upd;
  });

  return res.json(updated);
}));

export default router;
