/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  Public Repair Tracking — لتتبّع العميل لطلب الصيانة عبر الـ QR           ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * مسار مفتوح (بدون مصادقة مستخدم) لكنه يشترط رمز تحقق HMAC لا يمكن تخمينه.
 *
 * الحماية:
 *   - يشترط token = HMAC-SHA256(REPAIR_TRACKING_SECRET, companyId:jobNo)
 *   - بدون السر يُعاد 503 (إغلاق بالإعداد الافتراضي — fail-closed)
 *   - rate-limited: 10 طلبات/دقيقة/IP للحدّ من الاستطلاع
 *   - يُخفي كل البيانات الحساسة (تكاليف، عربون، PIN الجهاز، أرقام التواصل)
 *
 * SEC: الرابط القصير /public/repair-track/:jobNo أُزيل لأنه لا يمتلك أي مصادقة
 *      ولا رمز تحقق، ولا معرّف شركة، مما يسمح بالتعداد عبر jobNo وحده.
 */

import { Router, type IRouter } from "express";
import { eq, and, asc } from "drizzle-orm";
import rateLimit from "express-rate-limit";
import { db, repairJobsTable, repairStatusHistoryTable, repairStatusesTable, repairDevicePhotosTable } from "@workspace/db";
import { wrap } from "../lib/async-handler";
import { isTrackingEnabled, verifyTrackingToken } from "../lib/tracking-token";
import { z } from "zod/v4";

const router: IRouter = Router();

const RepairTrackingQuery = z.object({
  token: z.string().min(1, "رمز التتبع مطلوب"),
});

/**
 * حدّاد طلبات للتتبع العام: 10 طلبات / دقيقة / IP
 */
const publicTrackingLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "محاولات كثيرة — حاول بعد دقيقة" },
});

/**
 * Fallback Arabic labels — يُطابق STATUS_MAP في الواجهة (repairs.tsx)
 */
const FALLBACK_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:                    { label: "انتظار",                color: "#f59e0b" },
  in_progress:                { label: "جارٍ الإصلاح",          color: "#3b82f6" },
  done:                       { label: "تم الإصلاح",            color: "#10b981" },
  delivered:                  { label: "تم التسليم",            color: "#a855f7" },
  cancelled:                  { label: "ملغي",                  color: "#ef4444" },
  received:                   { label: "استلام الجهاز",         color: "#8b5cf6" },
  initial_inspection:         { label: "الفحص الأولي",          color: "#6366f1" },
  diagnosis:                  { label: "التشخيص",               color: "#3b82f6" },
  waiting_customer_approval:  { label: "انتظار موافقة العميل",  color: "#f59e0b" },
  approved:                   { label: "تمت الموافقة",          color: "#10b981" },
  in_repair:                  { label: "جاري الإصلاح",          color: "#06b6d4" },
  repaired:                   { label: "تم الإصلاح",            color: "#14b8a6" },
  final_quality_check:        { label: "مراقبة الجودة",         color: "#a855f7" },
  ready_for_delivery:         { label: "جاهز للتسليم",          color: "#84cc16" },
  rejected:                   { label: "مرفوض",                 color: "#dc2626" },
  waiting_parts:              { label: "بانتظار قطعة",          color: "#ec4899" },
  qa:                         { label: "اختبار الجودة",         color: "#06b6d4" },
  diagnosing:                 { label: "قيد الفحص",             color: "#3b82f6" },
  shipped:                    { label: "قيد الشحن",             color: "#0ea5e9" },
};

/**
 * GET /api/public/repair-tracking/:companyId/:jobNo?token=<hmac>
 *
 * يُعيد بيانات تتبع الطلب الموجزة — متاح للجمهور بشرط رمز HMAC صحيح.
 *
 * الرمز: HMAC-SHA256(REPAIR_TRACKING_SECRET, "${companyId}:${jobNo}") أوّل 32 حرف hex
 * يتم حساب الرمز على الخادم وإرساله للواجهة مع بيانات الطلب، ثم يُضمَّن في رابط QR.
 */
router.get("/public/repair-tracking/:companyId/:jobNo", publicTrackingLimiter, wrap(async (req, res) => {
  /* SEC: fail-closed — إذا لم يُضبط السر يُرفض كل الوصول */
  if (!isTrackingEnabled()) {
    return res.status(503).json({ error: "خدمة التتبع غير مُهيَّأة على الخادم" });
  }

  const companyId = Number(req.params.companyId);
  const jobNo = String(req.params.jobNo ?? "").trim();

  if (!Number.isFinite(companyId) || companyId <= 0 || !jobNo) {
    return res.status(400).json({ error: "بيانات غير صالحة" });
  }

  const parsedQuery = RepairTrackingQuery.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({ error: "معاملات الاستعلام غير صحيحة", details: parsedQuery.error.issues.map(i => i.message) });
  }

  const token = parsedQuery.data.token;

  /* SEC: التحقق من رمز HMAC قبل أي وصول للقاعدة */
  if (!verifyTrackingToken(companyId, jobNo, token)) {
    return res.status(401).json({ error: "رابط التتبع غير صالح أو منتهي الصلاحية" });
  }

  /* فلترة صارمة: شركة + رقم طلب — يجب أن يتطابق الاثنان */
  const [job] = await db.select({
    id: repairJobsTable.id,
    job_no: repairJobsTable.job_no,
    customer_name: repairJobsTable.customer_name,
    device_brand: repairJobsTable.device_brand,
    device_model: repairJobsTable.device_model,
    status: repairJobsTable.status,
    received_at: repairJobsTable.received_at,
    estimated_delivery: repairJobsTable.estimated_delivery,
    delivered_at: repairJobsTable.delivered_at,
    company_id: repairJobsTable.company_id,
    qa_report: repairJobsTable.qa_report,
    qa_inspector_name: repairJobsTable.qa_inspector_name,
  })
    .from(repairJobsTable)
    .where(and(
      eq(repairJobsTable.company_id, companyId),
      eq(repairJobsTable.job_no, jobNo),
    ));

  if (!job) {
    return res.status(404).json({ error: "لم يتم العثور على طلب بهذا الرقم" });
  }

  /* قائمة الحالات المُعرَّفة لهذه الشركة */
  const statusRows = await db.select({
    key: repairStatusesTable.key,
    label_ar: repairStatusesTable.label_ar,
    color: repairStatusesTable.color,
  })
    .from(repairStatusesTable)
    .where(eq(repairStatusesTable.company_id, companyId));
  const statusMap = new Map(statusRows.map(s => [s.key, s]));

  const fmtStatus = (key: string | null | undefined) => {
    if (!key) return null;
    const s = statusMap.get(key);
    if (s) return { key, label: s.label_ar, color: s.color ?? "#64748b" };
    // eslint-disable-next-line security/detect-object-injection
    const f = FALLBACK_STATUS_LABELS[key];
    return { key, label: f?.label ?? key, color: f?.color ?? "#64748b" };
  };

  /* التاريخ — فقط تغيُّرات الحالة، نُخفي تقارير المهندس والملاحظات الداخلية */
  const historyRows = await db.select({
    status_to: repairStatusHistoryTable.status_to,
    status_from: repairStatusHistoryTable.status_from,
    event_type: repairStatusHistoryTable.event_type,
    created_at: repairStatusHistoryTable.created_at,
  })
    .from(repairStatusHistoryTable)
    .where(and(
      eq(repairStatusHistoryTable.job_id, job.id),
      eq(repairStatusHistoryTable.company_id, companyId),
    ))
    .orderBy(asc(repairStatusHistoryTable.created_at));

  const history = historyRows
    .filter(h => h.event_type !== "engineer_report" && h.status_to)
    .map(h => ({
      from: fmtStatus(h.status_from),
      to:   fmtStatus(h.status_to),
      at:   h.created_at,
    }));

  /* إخفاء جزء من اسم العميل لحماية الخصوصية */
  const maskedName = (() => {
    const n = (job.customer_name ?? "").trim();
    if (!n) return "";
    const parts = n.split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2) + "***";
    return parts[0] + " " + (parts[1]?.[0] ?? "") + "***";
  })();

  /* صور الجهاز (قبل/بعد) — متاحة للعميل */
  const photos = await db.select({
    photo_url: repairDevicePhotosTable.photo_url,
    photo_type: repairDevicePhotosTable.photo_type,
    uploaded_at: repairDevicePhotosTable.uploaded_at,
  })
    .from(repairDevicePhotosTable)
    .where(eq(repairDevicePhotosTable.repair_job_id, job.id))
    .orderBy(asc(repairDevicePhotosTable.uploaded_at));

  return res.json({
    job_no: job.job_no,
    customer_name_masked: maskedName,
    device: `${job.device_brand ?? ""} ${job.device_model ?? ""}`.trim(),
    status: fmtStatus(job.status),
    received_at: job.received_at,
    estimated_delivery: job.estimated_delivery,
    delivered_at: job.delivered_at,
    qa_report: job.qa_report ?? null,
    qa_inspector_name: job.qa_inspector_name ?? null,
    photos,
    history,
  });
}));

export default router;
