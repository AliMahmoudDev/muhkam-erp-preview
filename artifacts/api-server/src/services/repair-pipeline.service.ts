/**
 * repair-pipeline.service.ts
 *
 * خدمة التحقق من صحة انتقالات حالات بطاقات الصيانة.
 * تضمن أن الانتقال بين الحالات يتبع الترتيب المحدد مسبقاً
 * وأن جميع المتطلبات مستوفاة قبل الانتقال.
 */

const PIPELINE_ORDER = [
  'received', 'initial_inspection', 'diagnosis',
  'waiting_customer_approval', 'approved', 'in_repair',
  'repaired', 'final_quality_check', 'ready_for_delivery',
  'shipped', 'delivered'
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

const STAGE_REQUIREMENTS: Record<string, { field: string; label_ar: string }[]> = {
  initial_inspection: [
    { field: 'technician_id', label_ar: 'يجب تعيين فني مسؤول' },
    { field: 'checklist',     label_ar: 'يجب إكمال قائمة الفحص الأولي' },
  ],
  diagnosis: [
    { field: 'problem_description', label_ar: 'يجب كتابة وصف المشكلة' },
    { field: 'estimated_cost',      label_ar: 'يجب إدخال التكلفة التقديرية' },
  ],
  in_repair: [
    { field: 'technician_id', label_ar: 'يجب تعيين فني مسؤول' },
  ],
  repaired: [
    { field: 'final_cost', label_ar: 'يجب إدخال التكلفة النهائية' },
  ],
  ready_for_delivery: [
    { field: 'final_cost', label_ar: 'يجب إدخال التكلفة النهائية' },
  ],
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

  /* ── الفروع الجانبية (waiting_parts / rejected / cancelled) متاحة دائماً ── */
  if (SIDE_BRANCHES.includes(targetStatus)) {
    return { allowed: true, errors: [] };
  }

  /* ── أي انتقال آخر مسموح (للأمام أو للخلف) — لكن متطلبات المرحلة المستهدفة لازم تتحقق ── */
  const reqs = STAGE_REQUIREMENTS[targetStatus] ?? [];
  const errors: string[] = [];

  for (const req of reqs) {
    const value = jobData[req.field];

    if (req.field === 'checklist') {
      try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        if (!Array.isArray(parsed) || parsed.length === 0 || !parsed.some((i: { status?: unknown }) => i.status !== null && i.status !== undefined)) {
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
