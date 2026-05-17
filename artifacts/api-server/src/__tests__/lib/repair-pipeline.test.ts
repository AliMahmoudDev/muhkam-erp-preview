/**
 * repair-pipeline.service.ts — unit tests
 *
 * يتحقق من صحة منطق validateTransition لانتقالات حالات بطاقات الصيانة.
 */
import { describe, it, expect } from "vitest";
import { validateTransition } from "../../services/repair-pipeline.service";

/* ── بيانات مشتركة ── */
const BASE_JOB: Record<string, unknown> = {
  technician_id:           "tech-1",
  problem_description:     "شاشة مكسورة",
  estimated_cost:          "150",
  final_cost:              "200",
  qa_completed_at:         new Date().toISOString(),
  pre_delivery_reviewed_at: new Date().toISOString(),
  shipping_settled_at:     new Date().toISOString(),
  notes:                   "ملاحظة",
  checklist:               JSON.stringify([{ id: "1", label: "شاشة", status: "fail" }]),
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
   4. الإصلاح الرئيسي — جهاز بلا فحص استلام (no intake checklist)
   ══════════════════════════════════════════════════════════════ */
describe("validateTransition — جهاز بلا فحص استلام (البق المُصلَح)", () => {
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

  it("لا يزال يشترط qa_completed_at لو checklist يحوي بنوداً", () => {
    const r = validateTransition("final_quality_check", "ready_for_delivery", {
      ...BASE_JOB,
      checklist:       JSON.stringify([{ id: "1", label: "شاشة", status: "fail" }]),
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
