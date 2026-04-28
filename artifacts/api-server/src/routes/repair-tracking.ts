/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  Public Repair Tracking — لتتبّع العميل لطلب الصيانة عبر الـ QR           ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * مسار مفتوح (بدون مصادقة) يُعيد فقط البيانات الضرورية للعميل:
 *   - رقم الطلب، اسم العميل (للتأكيد فقط)، الجهاز
 *   - الحالة الحالية + تاريخ التحديثات (دون أسماء فنيين / تكاليف داخلية / تقارير المهندس)
 *
 * الأمان:
 *   - rate-limited عبر generalLimiter العام على /api/*
 *   - يَستخدم company_id + job_no معاً (لأن job_no غير فريد عبر الشركات)
 *   - يُخفي كل البيانات الحساسة (تكاليف، عربون، PIN الجهاز، أرقام التواصل، إلخ)
 */

import { Router, type IRouter } from "express";
import { eq, and, asc } from "drizzle-orm";
import rateLimit from "express-rate-limit";
import { db, repairJobsTable, repairStatusHistoryTable, repairStatusesTable } from "@workspace/db";
import { wrap } from "../lib/async-handler";

const router: IRouter = Router();

/**
 * حدّاد طلبات للتتبع العام: 10 طلبات / دقيقة / IP — يحمي من الـ scraping الجماعي
 * لأرقام الطلبات (job_no قابل للتخمين رقمياً).
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
 * يُستخدم عندما لا تُعرّف الشركة الحالة في جدول repair_statuses.
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
 * GET /api/public/repair-tracking/:companyId/:jobNo
 * يُعيد بيانات تتبع الطلب الموجزة — متاح للجمهور.
 */
router.get("/public/repair-tracking/:companyId/:jobNo", publicTrackingLimiter, wrap(async (req, res) => {
  const companyId = Number(req.params.companyId);
  const jobNo = String(req.params.jobNo ?? "").trim();

  if (!Number.isFinite(companyId) || companyId <= 0 || !jobNo) {
    return res.status(400).json({ error: "بيانات غير صالحة" });
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
  })
    .from(repairJobsTable)
    .where(and(
      eq(repairJobsTable.company_id, companyId),
      eq(repairJobsTable.job_no, jobNo),
    ));

  if (!job) {
    return res.status(404).json({ error: "لم يتم العثور على طلب بهذا الرقم" });
  }

  /* قائمة الحالات المُعرَّفة لهذه الشركة — للحصول على التسميات والألوان الصحيحة */
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

  /* إخفاء جزء من اسم العميل لحماية الخصوصية: "أحمد م***" */
  const maskedName = (() => {
    const n = (job.customer_name ?? "").trim();
    if (!n) return "";
    const parts = n.split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2) + "***";
    return parts[0] + " " + (parts[1]?.[0] ?? "") + "***";
  })();

  return res.json({
    job_no: job.job_no,
    customer_name_masked: maskedName,
    device: `${job.device_brand ?? ""} ${job.device_model ?? ""}`.trim(),
    status: fmtStatus(job.status),
    received_at: job.received_at,
    estimated_delivery: job.estimated_delivery,
    delivered_at: job.delivered_at,
    history,
  });
}));

/**
 * GET /api/public/repair-track/:jobNo
 *
 * نسخة مُختصَرة من رابط التتبّع تستخدم رقم الطلب فقط — بدون companyId.
 * للحماية: إن وُجدت بطاقات بنفس الرقم في أكثر من شركة، نُرجع 404 (تجنّب
 * كشف وجود الرقم في شركة أخرى).
 *
 * مُحدَّد بمعدّل 10 طلبات/دقيقة/IP.
 */
router.get("/public/repair-track/:jobNo", publicTrackingLimiter, wrap(async (req, res) => {
  const jobNo = String(req.params.jobNo ?? "").trim();
  if (!jobNo) return res.status(400).json({ error: "رقم الطلب مطلوب" });

  /* جلب أوّل بطاقتين فقط — لاكتشاف التضارب دون مسح كل القاعدة */
  const matches = await db.select({
    id: repairJobsTable.id,
    company_id: repairJobsTable.company_id,
    job_no: repairJobsTable.job_no,
    customer_name: repairJobsTable.customer_name,
    device_brand: repairJobsTable.device_brand,
    device_model: repairJobsTable.device_model,
    status: repairJobsTable.status,
    received_at: repairJobsTable.received_at,
    estimated_delivery: repairJobsTable.estimated_delivery,
    delivered_at: repairJobsTable.delivered_at,
  })
    .from(repairJobsTable)
    .where(eq(repairJobsTable.job_no, jobNo))
    .limit(2);

  /* ما لقيناش طلب أو فيه أكثر من شركة بنفس الرقم → 404 (لا نُفصح عن وجود تضارب) */
  if (matches.length === 0 || matches.length > 1) {
    return res.status(404).json({ error: "لم يتم العثور على طلب بهذا الرقم" });
  }

  const job = matches[0];
  const companyId = job.company_id;

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
    const f = FALLBACK_STATUS_LABELS[key];
    return { key, label: f?.label ?? key, color: f?.color ?? "#64748b" };
  };

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

  const maskedName = (() => {
    const n = (job.customer_name ?? "").trim();
    if (!n) return "";
    const parts = n.split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2) + "***";
    return parts[0] + " " + (parts[1]?.[0] ?? "") + "***";
  })();

  return res.json({
    job_no: job.job_no,
    customer_name_masked: maskedName,
    device: `${job.device_brand ?? ""} ${job.device_model ?? ""}`.trim(),
    status: fmtStatus(job.status),
    received_at: job.received_at,
    estimated_delivery: job.estimated_delivery,
    delivered_at: job.delivered_at,
    history,
  });
}));

export default router;
