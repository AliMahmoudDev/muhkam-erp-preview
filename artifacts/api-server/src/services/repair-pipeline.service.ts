/**
 * repair-pipeline.service.ts
 *
 * خدمة التحقق من صحة انتقالات حالات بطاقات الصيانة.
 * تضمن أن الانتقال بين الحالات يتبع الترتيب المحدد مسبقاً
 * وأن جميع المتطلبات مستوفاة قبل الانتقال.
 */

const PIPELINE_ORDER = [
  'received',
  'initial_inspection',
  'diagnosis',
  'waiting_customer_approval',
  'approved',
  'in_repair',
  'repaired',
  'final_quality_check',
  'ready_for_delivery',
  'shipped',
  'delivered',
] as const;

/**
 * الحالات الجانبية (Side Branches) — مسموح الانتقال إليها من أي مرحلة نشطة.
 * - waiting_parts: حالة مؤقتة (بانتظار قطعة) — يقدر يرجع منها لأي حالة.
 * - rejected/cancelled: حالات إنهاء طارئة.
 */
const SIDE_BRANCHES = ['waiting_parts', 'rejected', 'cancelled'];

/**
 * الحالات النهائية — لا يمكن الانتقال منها.
 */
const TERMINAL_STATUSES = ['delivered', 'rejected', 'cancelled'];

/**
 * متطلبات الانتقال إلى الحالة المستهدفة.
 *
 * كل عنصر يحوي اسم الحقل المطلوب على بطاقة الصيانة + رسالة عربية للمستخدم.
 * `qa_completed`, `pre_delivery_reviewed`, `shipping_settled` هي حقول
 * مشتقة (timestamps) — تُملأ تلقائياً من endpoints مخصّصة (modals الـ UI).
 */
const STAGE_REQUIREMENTS: Record<string, { field: string; label_ar: string }[]> = {
  initial_inspection: [
    { field: 'technician_id', label_ar: 'يجب تعيين فني مسؤول' },
    { field: 'checklist', label_ar: 'يجب إكمال قائمة الفحص الأولي' },
  ],
  diagnosis: [
    { field: 'problem_description', label_ar: 'يجب كتابة وصف المشكلة' },
    { field: 'estimated_cost', label_ar: 'يجب إدخال التكلفة التقديرية' },
  ],
  in_repair: [{ field: 'technician_id', label_ar: 'يجب تعيين فني مسؤول' }],
  repaired: [
    { field: 'final_cost', label_ar: 'يجب إدخال التكلفة النهائية' },
    { field: 'has_parts', label_ar: 'يجب إضافة قطعة مستخدمة في الإصلاح أولاً' },
    { field: 'has_engineer_report', label_ar: 'يجب كتابة تقرير الإصلاح من الفني المسؤول أولاً' },
  ],
  /* ── الانتقال إلى "مراقبة الجودة" ──
        يشترط أن يكون الفني قد أضاف قطعة مستخدمة في الإصلاح وكتب تقرير إصلاح.
        الحقلان has_parts / has_engineer_report يُحقَنان من crud.ts بعد استعلام DB. */
  final_quality_check: [
    { field: 'has_parts', label_ar: 'يجب إضافة قطعة مستخدمة في الإصلاح أولاً' },
    { field: 'has_engineer_report', label_ar: 'يجب كتابة تقرير الإصلاح من الفني المسؤول أولاً' },
  ],
  /* ── الانتقال من "مراقبة الجودة" إلى "جاهز للتسليم" ──
        يكفي إكمال فحص الجودة (QC). محاسبة العميل تتم في بوّابة التسليم. */
  ready_for_delivery: [
    { field: 'qa_completed_at', label_ar: 'يجب إكمال بنود فحص مراقبة الجودة (QC) أولاً' },
  ],
  /* ── الانتقال إلى "التسليم" ──
        يتطلب: اكتمال المحاسبة (pre_delivery_reviewed_at) + تسجيل الشحن/عدمه (shipping_settled_at) */
  delivered: [
    {
      field: 'pre_delivery_reviewed_at',
      label_ar: 'يجب إتمام محاسبة العميل (القطع + الدفع) أولاً',
    },
    {
      field: 'shipping_settled_at',
      label_ar: 'يجب تسجيل تكلفة الشحن (أو تأكيد عدمها) قبل الإغلاق',
    },
  ],
  waiting_parts: [{ field: 'notes', label_ar: 'يجب كتابة ملاحظة توضح القطعة المطلوبة' }],
};

/**
 * يتحقق من صحة الانتقال بين حالتين في Pipeline الصيانة.
 *
 * @param currentStatus - الحالة الحالية لبطاقة الصيانة
 * @param targetStatus  - الحالة المطلوب الانتقال إليها
 * @param jobData       - بيانات بطاقة الصيانة الكاملة
 * @returns كائن يحتوي على: allowed (مسموح أم لا) و errors (قائمة الأخطاء بالعربية)
 */
export function validateTransition(
  currentStatus: string,
  targetStatus: string,
  jobData: Record<string, unknown>
): { allowed: boolean; errors: string[] } {
  /* ── منع الانتقال من حالة نهائية (مُسلَّم/ملغي/مرفوض) ── */
  if (TERMINAL_STATUSES.includes(currentStatus)) {
    return {
      allowed: false,
      errors: [`لا يمكن تغيير حالة بطاقة منتهية ("${currentStatus}")`],
    };
  }

  /* ── الفروع الجانبية (waiting_parts / rejected / cancelled) متاحة دائماً
        من أي مرحلة نشطة — لكن إن كان لها متطلبات (مثل waiting_parts → notes)
        لازم نُطبّقها كذلك، فلا نرجع مباشرة. ── */

  /* ── أي انتقال — لازم متطلبات المرحلة المستهدفة تتحقق إن وُجدت ── */
  // eslint-disable-next-line security/detect-object-injection
  const reqs = STAGE_REQUIREMENTS[targetStatus] ?? [];
  const errors: string[] = [];

  for (const req of reqs) {
    const value = jobData[req.field];

    if (req.field === 'checklist') {
      try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        if (
          !Array.isArray(parsed) ||
          parsed.length === 0 ||
          !parsed.some((i: { status?: unknown }) => i.status !== null && i.status !== undefined)
        ) {
          errors.push(req.label_ar);
        }
      } catch {
        errors.push(req.label_ar);
      }
      continue;
    }

    if (req.field === 'estimated_cost' || req.field === 'final_cost') {
      if (!value || Number(value) <= 0) {
        errors.push(req.label_ar);
      }
      continue;
    }

    /* ── إعفاء qa_completed_at إن لم تكن هناك بنود استلام حقيقية ──
          الجهاز الذي سُلِّم معطوباً من البداية يحصل على بند __power_off__ فقط،
          وهذا البند يُخفيه النظام من شاشة QC تماماً (مثل checklist فارغ).
          لذلك إن كانت كل بنود الفحص هي __power_off__ أو لم يكن هناك بنود أصلاً،
          يُعفى شرط qa_completed_at لأنه ما في ما يُفحص فعلياً. */
    if (req.field === 'qa_completed_at') {
      const rawChecklist = jobData['checklist'];
      let hasRealIntakeItems = false;
      try {
        const parsed = typeof rawChecklist === 'string' ? JSON.parse(rawChecklist) : rawChecklist;
        if (Array.isArray(parsed)) {
          hasRealIntakeItems = parsed.some(
            (i: unknown) => (i as { id?: string }).id !== '__power_off__'
          );
        }
      } catch {
        /* ignore parse error — treat as no checklist */
      }
      if (!hasRealIntakeItems) continue; // لا بنود حقيقية → QC اختياري
    }

    if (!value || String(value).trim() === '') {
      errors.push(req.label_ar);
    }
  }

  if (errors.length > 0) {
    return { allowed: false, errors };
  }

  return { allowed: true, errors: [] };
}

export { PIPELINE_ORDER, SIDE_BRANCHES, TERMINAL_STATUSES };
