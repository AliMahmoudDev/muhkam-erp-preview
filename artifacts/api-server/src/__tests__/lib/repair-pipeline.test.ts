/**
 * repair-pipeline.service.ts — unit tests
 *
 * يتحقق من صحة منطق validateTransition لانتقالات حالات بطاقات الصيانة.
 */
import { describe, it, expect } from "vitest";
import { validateTransition } from "../../services/repair-pipeline.service";

/* ── بيانات مشتركة ── */
const BASE_JOB: Record<string, unknown> = {
  technician_id:            "tech-1",
  problem_description:      "شاشة مكسورة",
  estimated_cost:           "150",
  final_cost:               "200",
  qa_completed_at:          new Date().toISOString(),
  pre_delivery_reviewed_at: new Date().toISOString(),
  shipping_settled_at:      new Date().toISOString(),
  notes:                    "ملاحظة",
  checklist:                JSON.stringify([{ id: "1", label: "شاشة", status: "fail" }]),
  /* حقول مُحقَنة من crud.ts عند الانتقال إلى repaired */
  has_parts:                true,
  has_engineer_report:      true,
};

/* ═══════════════════════════════════════════════════════════════
   1. انتقالات أساسية مسموح بها
   ══════════════════════════════════════════════════════════════ */
describe("validateTransition — انتقالات مسموح بها", () => {
  it("initial_inspection مع تقني + checklist", () => {
    const r = validateTransition("received", "initial_inspection", {
      ...BASE_JOB,
      checklist: JSON.stringify([{ id: "1", label: "شاشة", status: "pass" }]),
    });
    expect(r.allowed).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it("diagnosis مع وصف + تكلفة تقديرية", () => {
    const r = validateTransition("initial_inspection", "diagnosis", BASE_JOB);
    expect(r.allowed).toBe(true);
  });

  it("ready_for_delivery مع qa_completed_at + checklist موجود", () => {
    const r = validateTransition("final_quality_check", "ready_for_delivery", BASE_JOB);
    expect(r.allowed).toBe(true);
  });

  it("delivered مع pre_delivery_reviewed_at + shipping_settled_at", () => {
    const r = validateTransition("ready_for_delivery", "delivered", BASE_JOB);
    expect(r.allowed).toBe(true);
  });

  it("الفروع الجانبية — waiting_parts مع notes", () => {
    const r = validateTransition("in_repair", "waiting_parts", { ...BASE_JOB, notes: "ننتظر شاشة" });
    expect(r.allowed).toBe(true);
  });

  it("rejected مسموح دون متطلبات إضافية", () => {
    const r = validateTransition("in_repair", "rejected", BASE_JOB);
    expect(r.allowed).toBe(true);
  });

  it("cancelled مسموح دون متطلبات إضافية", () => {
    const r = validateTransition("diagnosis", "cancelled", BASE_JOB);
    expect(r.allowed).toBe(true);
  });
});

/* ═══════════════════════════════════════════════════════════════
   2. انتقالات محظورة (حالات نهائية)
   ══════════════════════════════════════════════════════════════ */
describe("validateTransition — حالات نهائية", () => {
  it("لا يمكن الانتقال من delivered", () => {
    const r = validateTransition("delivered", "received", BASE_JOB);
    expect(r.allowed).toBe(false);
    expect(r.errors[0]).toMatch(/منتهية/);
  });

  it("لا يمكن الانتقال من rejected", () => {
    const r = validateTransition("rejected", "in_repair", BASE_JOB);
    expect(r.allowed).toBe(false);
  });

  it("لا يمكن الانتقال من cancelled", () => {
    const r = validateTransition("cancelled", "received", BASE_JOB);
    expect(r.allowed).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════════════════
   3. متطلبات مفقودة — أخطاء متوقعة
   ══════════════════════════════════════════════════════════════ */
describe("validateTransition — متطلبات مفقودة", () => {
  it("initial_inspection بدون technician_id", () => {
    const r = validateTransition("received", "initial_inspection", {
      ...BASE_JOB,
      technician_id: null,
      checklist: JSON.stringify([{ id: "1", label: "شاشة", status: "pass" }]),
    });
    expect(r.allowed).toBe(false);
    expect(r.errors).toContain("يجب تعيين فني مسؤول");
  });

  it("initial_inspection بدون checklist", () => {
    const r = validateTransition("received", "initial_inspection", {
      ...BASE_JOB,
      checklist: null,
    });
    expect(r.allowed).toBe(false);
    expect(r.errors).toContain("يجب إكمال قائمة الفحص الأولي");
  });

  it("initial_inspection بـ checklist فارغ []", () => {
    const r = validateTransition("received", "initial_inspection", {
      ...BASE_JOB,
      checklist: "[]",
    });
    expect(r.allowed).toBe(false);
  });

  it("diagnosis بدون estimated_cost", () => {
    const r = validateTransition("initial_inspection", "diagnosis", {
      ...BASE_JOB,
      estimated_cost: "0",
    });
    expect(r.allowed).toBe(false);
    expect(r.errors).toContain("يجب إدخال التكلفة التقديرية");
  });

  it("repaired بدون final_cost", () => {
    const r = validateTransition("in_repair", "repaired", {
      ...BASE_JOB,
      final_cost: "0",
    });
    expect(r.allowed).toBe(false);
    expect(r.errors).toContain("يجب إدخال التكلفة النهائية");
  });

  it("repaired بدون has_parts (لم تُضَف قطعة)", () => {
    const r = validateTransition("in_repair", "repaired", {
      ...BASE_JOB,
      has_parts: false,
    });
    expect(r.allowed).toBe(false);
    expect(r.errors).toContain("يجب إضافة قطعة مستخدمة في الإصلاح أولاً");
  });

  it("repaired بدون has_engineer_report (لم يُكتب تقرير الفني)", () => {
    const r = validateTransition("in_repair", "repaired", {
      ...BASE_JOB,
      has_engineer_report: false,
    });
    expect(r.allowed).toBe(false);
    expect(r.errors).toContain("يجب كتابة تقرير الإصلاح من الفني المسؤول أولاً");
  });

  it("repaired بدون has_parts وبدون has_engineer_report معاً", () => {
    const r = validateTransition("in_repair", "repaired", {
      ...BASE_JOB,
      has_parts:           false,
      has_engineer_report: false,
    });
    expect(r.allowed).toBe(false);
    expect(r.errors).toHaveLength(2);
  });

  it("repaired مسموح عندما تتوفر القطعة والتقرير والتكلفة", () => {
    const r = validateTransition("in_repair", "repaired", BASE_JOB);
    expect(r.allowed).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it("final_quality_check بدون has_parts (الانتقال المباشر من in_repair)", () => {
    const r = validateTransition("in_repair", "final_quality_check", {
      ...BASE_JOB,
      has_parts: false,
    });
    expect(r.allowed).toBe(false);
    expect(r.errors).toContain("يجب إضافة قطعة مستخدمة في الإصلاح أولاً");
  });

  it("final_quality_check بدون has_engineer_report (الانتقال المباشر من in_repair)", () => {
    const r = validateTransition("in_repair", "final_quality_check", {
      ...BASE_JOB,
      has_engineer_report: false,
    });
    expect(r.allowed).toBe(false);
    expect(r.errors).toContain("يجب كتابة تقرير الإصلاح من الفني المسؤول أولاً");
  });

  it("final_quality_check بدون has_parts وhas_engineer_report معاً", () => {
    const r = validateTransition("in_repair", "final_quality_check", {
      ...BASE_JOB,
      has_parts:           false,
      has_engineer_report: false,
    });
    expect(r.allowed).toBe(false);
    expect(r.errors).toHaveLength(2);
  });

  it("final_quality_check مسموح عندما تتوفر القطعة والتقرير", () => {
    const r = validateTransition("in_repair", "final_quality_check", BASE_JOB);
    expect(r.allowed).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it("ready_for_delivery بدون qa_completed_at (مع checklist موجود)", () => {
    const r = validateTransition("final_quality_check", "ready_for_delivery", {
      ...BASE_JOB,
      qa_completed_at: null,
    });
    expect(r.allowed).toBe(false);
    expect(r.errors).toContain("يجب إكمال بنود فحص مراقبة الجودة (QC) أولاً");
  });

  it("delivered بدون pre_delivery_reviewed_at", () => {
    const r = validateTransition("ready_for_delivery", "delivered", {
      ...BASE_JOB,
      pre_delivery_reviewed_at: null,
    });
    expect(r.allowed).toBe(false);
    expect(r.errors).toContain("يجب إتمام محاسبة العميل (القطع + الدفع) أولاً");
  });
});

/* ═══════════════════════════════════════════════════════════════
   4. الإصلاح الرئيسي — جهاز بلا بنود استلام حقيقية
      (checklist فارغ أو __power_off__ فقط)
   ══════════════════════════════════════════════════════════════ */
describe("validateTransition — جهاز بلا بنود استلام حقيقية (البق المُصلَح)", () => {
  /* ── حالات checklist فارغ/null ── */
  it("يسمح بـ ready_for_delivery لو checklist = null حتى بدون qa_completed_at", () => {
    const r = validateTransition("final_quality_check", "ready_for_delivery", {
      ...BASE_JOB,
      checklist:       null,
      qa_completed_at: null,
    });
    expect(r.allowed).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it("يسمح بـ ready_for_delivery لو checklist = [] حتى بدون qa_completed_at", () => {
    const r = validateTransition("final_quality_check", "ready_for_delivery", {
      ...BASE_JOB,
      checklist:       "[]",
      qa_completed_at: null,
    });
    expect(r.allowed).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it("يسمح بـ ready_for_delivery لو checklist = '' حتى بدون qa_completed_at", () => {
    const r = validateTransition("final_quality_check", "ready_for_delivery", {
      ...BASE_JOB,
      checklist:       "",
      qa_completed_at: null,
    });
    expect(r.allowed).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  /* ── السيناريو الحقيقي للمشكلة: جهاز لا يشتغل → __power_off__ فقط ── */
  it("يسمح بـ ready_for_delivery لو checklist = [__power_off__] حتى بدون qa_completed_at", () => {
    const r = validateTransition("final_quality_check", "ready_for_delivery", {
      ...BASE_JOB,
      checklist:       JSON.stringify([{ id: "__power_off__", label: "الجهاز لا يفتح", status: "fail" }]),
      qa_completed_at: null,
    });
    expect(r.allowed).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it("يسمح لو checklist يحوي __power_off__ + بنود أخرى كلها __power_off__ (متعددة)", () => {
    const r = validateTransition("final_quality_check", "ready_for_delivery", {
      ...BASE_JOB,
      checklist: JSON.stringify([
        { id: "__power_off__", label: "لا يفتح", status: "fail" },
        { id: "__power_off__", label: "لا يشتغل", status: "fail" },
      ]),
      qa_completed_at: null,
    });
    expect(r.allowed).toBe(true);
  });

  /* ── يجب إبقاء الشرط لو فيه بنود حقيقية ── */
  it("لا يزال يشترط qa_completed_at لو checklist يحوي بنوداً حقيقية", () => {
    const r = validateTransition("final_quality_check", "ready_for_delivery", {
      ...BASE_JOB,
      checklist:       JSON.stringify([{ id: "screen_check", label: "شاشة", status: "fail" }]),
      qa_completed_at: null,
    });
    expect(r.allowed).toBe(false);
    expect(r.errors).toContain("يجب إكمال بنود فحص مراقبة الجودة (QC) أولاً");
  });

  it("يشترط qa_completed_at لو checklist يحوي __power_off__ + بند حقيقي واحد", () => {
    const r = validateTransition("final_quality_check", "ready_for_delivery", {
      ...BASE_JOB,
      checklist: JSON.stringify([
        { id: "__power_off__", label: "لا يفتح", status: "fail" },
        { id: "screen_check",  label: "شاشة",     status: "fail" },
      ]),
      qa_completed_at: null,
    });
    expect(r.allowed).toBe(false);
    expect(r.errors).toContain("يجب إكمال بنود فحص مراقبة الجودة (QC) أولاً");
  });

  it("يسمح بـ ready_for_delivery لو checklist = null وqa_completed_at موجود (حالة عادية)", () => {
    const r = validateTransition("final_quality_check", "ready_for_delivery", {
      ...BASE_JOB,
      checklist:       null,
      qa_completed_at: new Date().toISOString(),
    });
    expect(r.allowed).toBe(true);
  });
});
