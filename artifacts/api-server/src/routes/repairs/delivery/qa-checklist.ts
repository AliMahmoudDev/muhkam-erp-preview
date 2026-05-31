import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  repairJobsTable,
  repairStatusHistoryTable,
} from "@workspace/db";
import { wrap } from "../../../lib/async-handler";
import { hasPermission } from "../../../lib/permissions";
import { ctx } from "../_shared";

const router: IRouter = Router();

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

export default router;
