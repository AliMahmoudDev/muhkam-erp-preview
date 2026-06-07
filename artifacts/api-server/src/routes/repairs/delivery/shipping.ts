import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import {
  db,
  repairJobsTable,
  repairJobPartsTable,
  repairStatusHistoryTable,
  expensesTable,
  expenseCategoriesTable,
  safesTable,
  transactionsTable,
  customerLedgerTable,
} from "@workspace/db";
import { wrap } from "../../../lib/async-handler";
import { hasPermission } from "../../../lib/permissions";
import { logger } from "../../../lib/logger";
import { getOrCreateSafeAccount, getOrCreateGeneralExpenseAccount, createAutoJournalEntry } from "../../../lib/auto-account";
import { ctx } from "../_shared";

const router: IRouter = Router();

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

  /* بيانات دفع التسليم (من الفرونت إند) لتسجيل حساب العميل */
  const deliveryGrandTotal = Math.max(0, Number(b.delivery_grand_total ?? 0));
  const deliveryCashPaid   = Math.max(0, Number(b.delivery_cash_paid   ?? 0));

  /* helper: تسجيل قيود حساب العميل بعد اكتمال التسليم */
  async function recordCustomerLedger(jobRow: typeof job) {
    if (!jobRow.customer_id || deliveryGrandTotal <= 0) return;
    const today = new Date().toISOString().split("T")[0]!;
    try {
      await db.insert(customerLedgerTable).values({
        customer_id:    jobRow.customer_id,
        type:           "repair",
        amount:         String(deliveryGrandTotal),
        reference_type: "repair_delivery",
        reference_id:   id,
        reference_no:   jobRow.job_no ?? undefined,
        description:    `تسليم بطاقة صيانة ${jobRow.job_no}`,
        date:           today,
        company_id,
      });
      if (deliveryCashPaid > 0) {
        await db.insert(customerLedgerTable).values({
          customer_id:    jobRow.customer_id,
          type:           "payment",
          amount:         String(-deliveryCashPaid),
          reference_type: "repair_delivery",
          reference_id:   id,
          reference_no:   jobRow.job_no ?? undefined,
          description:    `دفعة نقدية عند تسليم صيانة ${jobRow.job_no}`,
          date:           today,
          company_id,
        });
      }
    } catch (ledgerErr) {
      logger.error({ jobId: id, err: ledgerErr }, "[repair-shipping] customer-ledger insert failed");
    }
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

    await recordCustomerLedger(job);
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
    await recordCustomerLedger(txResult.job);
  }

  return res.json({ job: txResult?.job, expense: txResult?.expense });
}));

/**
 * (4) بيانات إيصال التسليم — للطباعة و WhatsApp.
 *
 * يُرجع البيانات المنسّقة (بدون HTML) ليبنيها العميل (frontend) كما يشاء —
 * هذا أوضح من إرجاع HTML.
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
