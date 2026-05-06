import { Router, type IRouter } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  db,
  repairJobsTable,
  repairPaymentsTable,
  repairStatusHistoryTable,
  safesTable,
  transactionsTable,
} from "@workspace/db";
import { wrap } from "../../lib/async-handler";
import { hasPermission } from "../../lib/permissions";
import { repairPaymentSchema } from "./_shared";

const router: IRouter = Router();

/* ══════════════════════════════════════════════════════════════
   REPAIR PAYMENTS — سجل دفعات الصيانة
══════════════════════════════════════════════════════════════ */

/* GET /api/repair-jobs/:id/payments — جلب دفعات تذكرة معينة */
router.get("/repair-jobs/:id/payments", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_repairs")) {
    res.status(403).json({ error: "غير مصرح بعرض دفعات الصيانة" }); return;
  }
  const companyId = req.user!.company_id!;
  const jobId = parseInt(String(req.params["id"]), 10);

  const [job] = await db.select({ id: repairJobsTable.id })
    .from(repairJobsTable)
    .where(and(eq(repairJobsTable.id, jobId), eq(repairJobsTable.company_id, companyId)));
  if (!job) { res.status(404).json({ error: "التذكرة غير موجودة" }); return; }

  const payments = await db.select().from(repairPaymentsTable)
    .where(and(eq(repairPaymentsTable.job_id, jobId), eq(repairPaymentsTable.company_id, companyId)))
    .orderBy(desc(repairPaymentsTable.created_at));

  res.json(payments.map(p => ({ ...p, amount: Number(p.amount) })));
}));

/* POST /api/repair-jobs/:id/payments — تسجيل دفعة جديدة */
router.post("/repair-jobs/:id/payments", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_repairs")) {
    res.status(403).json({ error: "غير مصرح بتسجيل دفعات الصيانة" }); return;
  }
  const companyId = req.user!.company_id!;
  const userId = req.user?.id;
  const userName = req.user?.username ?? "";
  const jobId = parseInt(String(req.params["id"]), 10);
  const vPay = repairPaymentSchema.safeParse(req.body);
  if (!vPay.success) { res.status(400).json({ error: vPay.error.errors[0]?.message ?? "بيانات غير صالحة" }); return; }
  const { amount: numAmount, payment_method, notes, safe_id } = vPay.data;

  const [job] = await db.select()
    .from(repairJobsTable)
    .where(and(eq(repairJobsTable.id, jobId), eq(repairJobsTable.company_id, companyId)));
  if (!job) { res.status(404).json({ error: "التذكرة غير موجودة" }); return; }

  /* تحقق من عدم تجاوز المتبقي */
  const existingPayments = await db.select({ amount: repairPaymentsTable.amount })
    .from(repairPaymentsTable)
    .where(and(eq(repairPaymentsTable.job_id, jobId), eq(repairPaymentsTable.company_id, companyId)));
  const totalPaid = existingPayments.reduce((s, p) => s + Number(p.amount), 0);
  const finalCost = Number(job.final_cost ?? job.estimated_cost ?? 0);
  const remaining = finalCost - totalPaid;
  if (numAmount > remaining + 0.01) {
    res.status(422).json({ error: `المبلغ (${numAmount}) يتجاوز المتبقي (${remaining.toFixed(2)})` });
    return;
  }

  /* عملية ذرّية: تسجيل الدفعة + قيد الخزنة + سطر المعاملة + تحديث deposit_paid + تاريخ */
  let safeName: string | null = null;
  if (safe_id) {
    const safeIdNum = Number(safe_id);
    const [safe] = await db.select().from(safesTable)
      .where(and(eq(safesTable.id, safeIdNum), eq(safesTable.company_id, companyId)));
    if (safe) safeName = safe.name;
  }

  const payment = await db.transaction(async (tx) => {
    /* 1) إنشاء صف الدفعة أولاً للحصول على id ثابت للربط */
    const [pmt] = await tx.insert(repairPaymentsTable).values({
      company_id: companyId,
      job_id: jobId,
      amount: String(numAmount),
      payment_method: String(payment_method ?? "cash"),
      notes: notes ? String(notes) : null,
      received_by: userId ?? null,
      received_by_name: userName,
      safe_id: safe_id ? Number(safe_id) : null,
      safe_name: safeName,
    }).returning();

    /* 2) قيد الخزنة + سطر معاملة مرتبط بـ payment.id (ربط 1:1 محكم) */
    if (safe_id && safeName) {
      const safeIdNum = Number(safe_id);
      await tx.update(safesTable)
        .set({ balance: sql`${safesTable.balance} + ${String(numAmount)}` })
        .where(and(eq(safesTable.id, safeIdNum), eq(safesTable.company_id, companyId)));
      await tx.insert(transactionsTable).values({
        type: "repair_payment",
        reference_type: "repair_payment",
        reference_id: pmt!.id,
        safe_id: safeIdNum,
        safe_name: safeName,
        amount: String(numAmount),
        direction: "in",
        description: `دفعة صيانة — بطاقة ${job.job_no}`,
        date: new Date().toISOString().split("T")[0]!,
        company_id: companyId,
      });
    }

    /* 3) تحديث deposit_paid */
    const newTotalPaid = totalPaid + numAmount;
    await tx.update(repairJobsTable)
      .set({ deposit_paid: String(newTotalPaid), updated_at: new Date() })
      .where(eq(repairJobsTable.id, jobId));

    /* 4) سطر التاريخ */
    await tx.insert(repairStatusHistoryTable).values({
      job_id: jobId,
      company_id: companyId,
      event_type: "payment",
      note: `تم استلام دفعة بقيمة ${numAmount} (${payment_method ?? "نقداً"})${notes ? ` — ${notes}` : ""}`,
      user_id: userId ?? null,
      user_name: userName,
      status_from: job.status,
      status_to: job.status,
    });

    return pmt!;
  });

  res.status(201).json({ ...payment, amount: Number(payment.amount) });
}));

/* DELETE /api/repair-jobs/:id/payments/:pid — حذف دفعة (ذرّي + عكس قيد الخزنة + audit) */
router.delete("/repair-jobs/:id/payments/:pid", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_repairs")) {
    res.status(403).json({ error: "غير مصرح بحذف دفعات الصيانة" }); return;
  }
  const companyId = req.user!.company_id!;
  const userId = req.user?.id;
  const userName = req.user?.username ?? "";
  const jobId = parseInt(String(req.params["id"]), 10);
  const pid = parseInt(String(req.params["pid"]), 10);

  const result = await db.transaction(async (tx) => {
    /* (claim) — الحذف الذرّي للصف يضمن أن طلب متزامن آخر لن يحصل على نفس الصف */
    const deleted = await tx.delete(repairPaymentsTable)
      .where(and(
        eq(repairPaymentsTable.id, pid),
        eq(repairPaymentsTable.job_id, jobId),
        eq(repairPaymentsTable.company_id, companyId),
      ))
      .returning();
    const payment = deleted[0];
    if (!payment) return { notFound: true as const };

    /* عكس تأثير الخزنة بربط محكم على payment.id (للسجلات الجديدة فقط) */
    if (payment.safe_id) {
      const amt = String(payment.amount);
      await tx.update(safesTable)
        .set({ balance: sql`${safesTable.balance} - ${amt}` })
        .where(and(eq(safesTable.id, payment.safe_id), eq(safesTable.company_id, companyId)));
      await tx.delete(transactionsTable).where(and(
        eq(transactionsTable.company_id, companyId),
        eq(transactionsTable.reference_type, "repair_payment"),
        eq(transactionsTable.reference_id, payment.id),
        eq(transactionsTable.type, "repair_payment"),
        eq(transactionsTable.direction, "in"),
      ));
    }

    /* إعادة احتساب deposit_paid */
    const remaining = await tx.select({ amount: repairPaymentsTable.amount })
      .from(repairPaymentsTable)
      .where(and(eq(repairPaymentsTable.job_id, jobId), eq(repairPaymentsTable.company_id, companyId)));
    const newTotal = remaining.reduce((s, p) => s + Number(p.amount), 0);
    const [job] = await tx.update(repairJobsTable)
      .set({ deposit_paid: String(newTotal), updated_at: new Date() })
      .where(eq(repairJobsTable.id, jobId))
      .returning();

    /* سطر audit في تاريخ البطاقة */
    await tx.insert(repairStatusHistoryTable).values({
      job_id: jobId,
      company_id: companyId,
      event_type: "payment",
      note: `تم حذف دفعة بقيمة ${Number(payment.amount)} (${payment.payment_method})${payment.safe_name ? ` من خزنة ${payment.safe_name}` : ""}`,
      user_id: userId ?? null,
      user_name: userName,
      status_from: job?.status ?? null,
      status_to: job?.status ?? null,
    });

    return { notFound: false as const };
  });

  if (result.notFound) { res.status(404).json({ error: "الدفعة غير موجودة" }); return; }
  res.json({ ok: true });
}));

export default router;
