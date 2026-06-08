/**
 * Repair job CRUD + engineer reports + repair customer routes:
 *   GET    /repair-jobs
 *   GET    /repair-jobs/:id
 *   POST   /repair-jobs
 *   PATCH  /repair-jobs/:id
 *   DELETE /repair-jobs/:id
 *   GET/POST/DELETE /repair-jobs/:id/engineer-reports
 *   GET    /repair-customers/lookup
 *   POST   /repair-customers
 */
import { Router, type IRouter } from "express";
import { eq, and, desc, sql, inArray, gt } from "drizzle-orm";
import {
  db,
  repairJobsTable,
  repairJobPartsTable,
  repairStatusHistoryTable,
} from "@workspace/db";
import { wrap } from "../../../lib/async-handler";
import { notifyUser } from "../../../lib/notify";
import { hasPermission } from "../../../lib/permissions";
import { computeTrackingToken } from "../../../lib/tracking-token";
import { validateTransition } from "../../../services/repair-pipeline.service";
import { lockJobCommissions } from "../../../services/commission.service";
import { writeAuditLog } from "../../../lib/audit-log";
import { normalizeName, getNextCustomerCode } from "../../customers";
import { getOrCreateCustomerAccount } from "../../../lib/auto-account";
import { findOrCreateCustomerByPhone } from "../../../lib/auto-customer";
import {
  ctx,
  nextJobNo,
  VALID_DEVICE_TYPES,
  type DeviceType,
  MAX_ENGINEER_REPORT_LEN,
  createRepairJobSchema,
} from "../_shared";

const router: IRouter = Router();

/* ══════════════════════════════════════════════════════════════
   LIST REPAIR JOBS
   ══════════════════════════════════════════════════════════════ */
router.get("/repair-jobs", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_repairs")) {
    return res.status(403).json({ error: "غير مصرح بعرض بطاقات الصيانة" });
  }
  const { company_id } = ctx(req);
  const { status, technician_id, search } = req.query as Record<string, string>;

  const conds = [eq(repairJobsTable.company_id, company_id)];
  if (status && status !== "all") {
    const list = status.split(",").map(s => s.trim()).filter(Boolean);
    if (list.length === 1)      conds.push(eq(repairJobsTable.status, list[0]));
    else if (list.length > 1)   conds.push(inArray(repairJobsTable.status, list));
  }
  if (technician_id && technician_id !== "all") {
    const tid = Number(technician_id);
    conds.push(sql`(${repairJobsTable.technician_id} = ${tid} OR ${repairJobsTable.technician_2_id} = ${tid})`);
  }

  const jobs = await db.select().from(repairJobsTable)
    .where(and(...conds))
    .orderBy(desc(repairJobsTable.created_at))
    .limit(1000);

  let filtered = jobs;
  if (search?.trim()) {
    const s = search.trim();
    const sl = s.toLowerCase();

    if (/^\d+$/.test(s)) {
      filtered = jobs.filter(j =>
        j.job_no.endsWith(`-${s}`) ||
        j.job_no.endsWith(`-${s.padStart(4, "0")}`)
      );
    } else {
      filtered = jobs.filter(j =>
        j.customer_name.toLowerCase().includes(sl) ||
        j.device_model.toLowerCase().includes(sl) ||
        j.device_brand.toLowerCase().includes(sl) ||
        j.job_no.toLowerCase().includes(sl) ||
        (j.imei && j.imei.toLowerCase().includes(sl)) ||
        (j.serial_no && j.serial_no.toLowerCase().includes(sl)) ||
        (j.customer_phone && j.customer_phone.includes(s)) ||
        (j.technician_name && j.technician_name.toLowerCase().includes(sl)) ||
        (j.technician_2_name && j.technician_2_name.toLowerCase().includes(sl))
      );
    }
  }
  return res.json(filtered.map(j => ({
    ...j,
    tracking_token: computeTrackingToken(j.company_id, j.job_no),
  })));
}));

/* ══════════════════════════════════════════════════════════════
   GET ONE REPAIR JOB
   ══════════════════════════════════════════════════════════════ */
router.get("/repair-jobs/:id", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_repairs")) {
    return res.status(403).json({ error: "غير مصرح بعرض بطاقات الصيانة" });
  }
  const { company_id } = ctx(req);
  const id = Number(req.params.id);

  const [job] = await db.select().from(repairJobsTable)
    .where(and(eq(repairJobsTable.id, id), eq(repairJobsTable.company_id, company_id)));
  if (!job) return res.status(404).json({ error: "بطاقة الصيانة غير موجودة" });

  const parts = await db.select().from(repairJobPartsTable)
    .where(and(eq(repairJobPartsTable.job_id, id), eq(repairJobPartsTable.company_id, company_id)));

  const history = await db.select().from(repairStatusHistoryTable)
    .where(and(eq(repairStatusHistoryTable.job_id, id), eq(repairStatusHistoryTable.company_id, company_id)))
    .orderBy(desc(repairStatusHistoryTable.created_at));

  return res.json({ ...job, parts, history, tracking_token: computeTrackingToken(job.company_id, job.job_no) });
}));

/* ══════════════════════════════════════════════════════════════
   CREATE REPAIR JOB
   ══════════════════════════════════════════════════════════════ */
router.post("/repair-jobs", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_repairs")) {
    return res.status(403).json({ error: "غير مصرح بإنشاء بطاقات الصيانة" });
  }
  const { company_id, user_id, user_name } = ctx(req);
  const vj = createRepairJobSchema.safeParse(req.body);
  if (!vj.success) return res.status(400).json({ error: vj.error.errors[0]?.message ?? "بيانات غير صالحة" });
  const b = req.body as Record<string, unknown>;
  const job_no = await nextJobNo(company_id);

  const customerNameInput = String(b.customer_name ?? "").trim();
  const customerPhoneInput = b.customer_phone ? String(b.customer_phone).trim() : null;
  const incomingCustomerId: number | null = b.customer_id ? Number(b.customer_id) : null;

  const job = await db.transaction(async (tx) => {
    let resolvedCustomerId: number | null = incomingCustomerId;
    if (!resolvedCustomerId && customerNameInput && customerPhoneInput) {
      const { id } = await findOrCreateCustomerByPhone(tx, company_id, {
        name: customerNameInput,
        phone: customerPhoneInput,
        classificationName: "عميل صيانة",
        isCustomer: true,
        source: "repair",
      });
      resolvedCustomerId = id;
    }

    const [createdJob] = await tx.insert(repairJobsTable).values({
    company_id,
    job_no,
    customer_name:        customerNameInput,
    customer_phone:       customerPhoneInput,
    customer_id:          resolvedCustomerId,
    device_brand:         String(b.device_brand ?? ""),
    device_model:         String(b.device_model ?? ""),
    device_type:          (() => {
      const dt = String(b.device_type ?? "general").trim();
      return VALID_DEVICE_TYPES.includes(dt as DeviceType) ? dt : "general";
    })(),
    imei:                 b.imei ? String(b.imei) : null,
    serial_no:            b.serial_no ? String(b.serial_no) : null,
    color:                b.color ? String(b.color) : null,
    storage:              b.storage ? String(b.storage) : null,
    problem_description:  b.problem_description ? String(b.problem_description) : null,
    technician_id:        b.technician_id ? Number(b.technician_id) : null,
    technician_name:      b.technician_name ? String(b.technician_name) : null,
    technician_2_id:      b.technician_2_id ? Number(b.technician_2_id) : null,
    technician_2_name:    b.technician_2_name ? String(b.technician_2_name) : null,
    technician_2_section: b.technician_2_section ? String(b.technician_2_section) : null,
    status:               "received",
    estimated_cost:       b.estimated_cost ? String(b.estimated_cost) : "0",
    deposit_paid:         b.deposit_paid ? String(b.deposit_paid) : "0",
    received_at:          String(b.received_at ?? new Date().toISOString().split("T")[0]),
    estimated_delivery:   b.estimated_delivery ? String(b.estimated_delivery) : null,
    notes:                b.notes ? String(b.notes) : null,
    checklist:            b.checklist ? JSON.stringify(b.checklist) : null,
    alert_days_threshold: b.alert_days_threshold ? Number(b.alert_days_threshold) : null,
    external_workshop:        Boolean(b.external_workshop),
    external_workshop_name:   b.external_workshop_name ? String(b.external_workshop_name) : null,
    external_workshop_cost:   b.external_workshop_cost ? String(b.external_workshop_cost) : "0",
    broker_name:              b.broker_name ? String(b.broker_name) : null,
    broker_commission:        b.broker_commission ? String(b.broker_commission) : "0",
    device_pin:               b.device_pin ? String(b.device_pin) : null,
    accessories:              b.accessories ? String(b.accessories) : null,
    branch_id:                b.branch_id ? Number(b.branch_id) : null,
    }).returning();

    await tx.insert(repairStatusHistoryTable).values({
      job_id: createdJob.id,
      company_id,
      status_to: "received",
      user_id,
      user_name,
      event_type: "created",
      note: "تم إنشاء بطاقة الصيانة",
    });

    return createdJob;
  });

  for (const tid of [job.technician_id, job.technician_2_id]) {
    if (tid) {
      await notifyUser(company_id, tid, {
        type: "repair_assigned",
        title: "تم تعيينك على بطاقة صيانة",
        message: `بطاقة ${job.job_no} — ${job.device_brand} ${job.device_model}`,
        link: `/repairs?job=${job.id}`,
        reference_id: job.id,
      });
    }
  }

  return res.status(201).json(job);
}));

/* ══════════════════════════════════════════════════════════════
   UPDATE REPAIR JOB
   ══════════════════════════════════════════════════════════════ */
router.patch("/repair-jobs/:id", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_repairs")) {
    return res.status(403).json({ error: "غير مصرح بتعديل بطاقات الصيانة" });
  }
  const { company_id, user_id, user_name } = ctx(req);
  const id = Number(req.params.id);
  const b = req.body as Record<string, unknown>;

  const [existing] = await db.select().from(repairJobsTable)
    .where(and(eq(repairJobsTable.id, id), eq(repairJobsTable.company_id, company_id)));
  if (!existing) return res.status(404).json({ error: "غير موجود" });
  if (existing.locked && !("locked" in b)) {
    return res.status(400).json({ error: "البطاقة مغلقة بعد التسليم — لا يمكن التعديل" });
  }

  if ("status" in b && String(b.status) !== existing.status) {
    let jobDataForValidation: Record<string, unknown> = existing as Record<string, unknown>;

    /* ── إذا كان الانتقال المستهدف هو "repaired" أو "final_quality_check"،
          نحقق من وجود قطعة مضافة وتقرير فني مكتوب قبل السماح بالانتقال.
          ملاحظة: الـ UI يقفز مباشرةً من in_repair → final_quality_check
          (repaired مخفي في الواجهة)، لذلك الشرط مطبَّق على كليهما. ── */
    if (String(b.status) === "repaired" || String(b.status) === "final_quality_check") {
      /* ── نجد متى دخلت البطاقة مرحلة "جاري الإصلاح" آخر مرة ──
            للتحقق من أن التقرير كُتب في هذه المرحلة تحديداً، لا قبلها. */
      const [partsRows, inRepairEntry] = await Promise.all([
        db.select({ count: sql<number>`count(*)` })
          .from(repairJobPartsTable)
          .where(eq(repairJobPartsTable.job_id, id)),
        db.select({ created_at: repairStatusHistoryTable.created_at })
          .from(repairStatusHistoryTable)
          .where(and(
            eq(repairStatusHistoryTable.job_id, id),
            eq(repairStatusHistoryTable.company_id, company_id),
            eq(repairStatusHistoryTable.status_to, "in_repair"),
          ))
          .orderBy(desc(repairStatusHistoryTable.created_at))
          .limit(1),
      ]);

      /* ── نبحث عن تقرير كُتب بعد دخول مرحلة "جاري الإصلاح" ──
            إن لم يوجد سجل الدخول (مثلاً: بطاقة قديمة قبل تطبيق القيد)،
            نرجع للتحقق التقليدي (أي تقرير موجود يكفي). */
      const inRepairAt = inRepairEntry[0]?.created_at ?? null;
      const reportFilter = inRepairAt
        ? and(
            eq(repairStatusHistoryTable.job_id, id),
            eq(repairStatusHistoryTable.company_id, company_id),
            eq(repairStatusHistoryTable.event_type, "engineer_report"),
            gt(repairStatusHistoryTable.created_at, inRepairAt),
          )
        : and(
            eq(repairStatusHistoryTable.job_id, id),
            eq(repairStatusHistoryTable.company_id, company_id),
            eq(repairStatusHistoryTable.event_type, "engineer_report"),
          );

      const [reportsRows] = await Promise.all([
        db.select({ count: sql<number>`count(*)` })
          .from(repairStatusHistoryTable)
          .where(reportFilter),
      ]);

      jobDataForValidation = {
        ...jobDataForValidation,
        has_parts:           Number(partsRows[0]?.count ?? 0) > 0,
        has_engineer_report: Number(reportsRows[0]?.count ?? 0) > 0,
      };
    }

    const { allowed, errors } = validateTransition(
      existing.status,
      String(b.status),
      jobDataForValidation,
    );
    if (!allowed) {
      return res.status(422).json({ error: errors.join(', ') });
    }
  }

  const updates: Record<string, unknown> = { updated_at: new Date() };
  const FIELDS = [
    "status","technician_id","technician_name","technician_2_id","technician_2_name","technician_2_section",
    "problem_description","notes","imei","serial_no","color","storage",
    "estimated_delivery","external_workshop","external_workshop_name",
    "broker_name","alert_days_threshold","qa_notes",
    "accessories","branch_id","device_pin",
    "device_brand","device_model",
    "qa_report","qa_inspector_name",
  ];
  // eslint-disable-next-line security/detect-object-injection
  for (const f of FIELDS) if (f in b) updates[f] = (b as Record<string, unknown>)[f];

  if ("device_type" in b) {
    const dt = String(b.device_type ?? "general").trim();
    updates.device_type = VALID_DEVICE_TYPES.includes(dt as DeviceType) ? dt : "general";
  }

  const NUM = ["estimated_cost","final_cost","deposit_paid","external_workshop_cost","broker_commission"];
  for (const f of NUM) {
    if (!(f in b)) continue;
    // eslint-disable-next-line security/detect-object-injection
    const raw = (b as Record<string, unknown>)[f];
    if (raw === null || raw === undefined || String(raw).trim() === "") {
      // eslint-disable-next-line security/detect-object-injection
      updates[f] = "0";
    } else {
      const num = Number(raw);
      if (!Number.isFinite(num)) {
        return res.status(400).json({ error: `قيمة غير صحيحة للحقل ${f}` });
      }
      // eslint-disable-next-line security/detect-object-injection
      updates[f] = String(num);
    }
  }

  if ("device_score" in b) updates.device_score = b.device_score ? Number(b.device_score) : null;
  if ("responsible_technician_id" in b) updates.responsible_technician_id = b.responsible_technician_id ? Number(b.responsible_technician_id) : null;
  if ("checklist" in b)    updates.checklist = JSON.stringify(b.checklist);
  if ("qa_checklist" in b) {
    updates.qa_checklist = JSON.stringify(b.qa_checklist);
  }
  if (b.status === "ready_for_delivery") {
    const incomingFinal = "final_cost" in updates ? Number(updates.final_cost ?? 0) : Number(existing.final_cost ?? 0);
    if (!Number.isFinite(incomingFinal) || incomingFinal <= 0) {
      return res.status(400).json({
        error: "يجب إدخال التكلفة النهائية (>0) قبل نقل البطاقة إلى \"جاهز للتسليم\"",
      });
    }
    /* إن لم تكن هناك بنود استلام حقيقية (null / [] / __power_off__ فقط) ولم يُكتمل QC،
       نضبط qa_completed_at تلقائياً — الجهاز المعطوب من البداية لا يحتاج QC. */
    if (!existing.qa_completed_at) {
      let hasRealIntakeItems = false;
      try {
        const raw = existing.checklist;
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (Array.isArray(parsed)) {
          hasRealIntakeItems = parsed.some(
            (i: unknown) => (i as { id?: string }).id !== '__power_off__'
          );
        }
      } catch { /* ignore */ }
      if (!hasRealIntakeItems) {
        updates.qa_completed_at = new Date();
      }
    }
  }
  if (b.status === "delivered") {
    updates.delivered_at = new Date().toISOString().split("T")[0];
    updates.locked = true;
  }

  /* ── تسليم: تحديث + قفل كوميشن + سجل الحالة — داخل transaction واحدة ──
        يضمن الذرية الكاملة: إما الثلاثة معاً أو لا شيء. ── */
  let updated: typeof existing;
  let statusHistoryHandled = false;

  if (String(b.status ?? "") === "delivered") {
    [updated] = await db.transaction(async (tx) => {
      const [u] = await tx
        .update(repairJobsTable)
        .set(updates)
        .where(and(eq(repairJobsTable.id, id), eq(repairJobsTable.company_id, company_id)))
        .returning();
      await tx.insert(repairStatusHistoryTable).values({
        job_id:      id,
        company_id,
        status_from: existing.status,
        status_to:   "delivered",
        user_id,
        user_name,
        event_type:  "pipeline_transition",
        note:        "انتقال تلقائي عبر Pipeline",
      });
      await lockJobCommissions(id, company_id, tx, existing.job_no);
      return [u];
    });
    statusHistoryHandled = true;
    void writeAuditLog({
      action:      "repair_status_change",
      record_type: "repair_job",
      record_id:   id,
      old_value:   { status: existing.status },
      new_value:   { status: "delivered" },
      user:        { id: user_id, username: user_name },
      company_id,
    });
  } else {
    [updated] = await db
      .update(repairJobsTable)
      .set(updates)
      .where(and(eq(repairJobsTable.id, id), eq(repairJobsTable.company_id, company_id)))
      .returning();
  }

  if (!statusHistoryHandled && b.status && b.status !== existing.status) {
    await db.insert(repairStatusHistoryTable).values({
      job_id:      id,
      company_id,
      status_from: existing.status,
      status_to:   String(b.status),
      user_id,
      user_name,
      event_type:  "pipeline_transition",
      note:        "انتقال تلقائي عبر Pipeline",
    });
    void writeAuditLog({
      action:      "repair_status_change",
      record_type: "repair_job",
      record_id:   id,
      old_value:   { status: existing.status },
      new_value:   { status: String(b.status) },
      user:        { id: user_id, username: user_name },
      company_id,
    });
  }

  for (const slot of [
    { idKey: "technician_id",   nameKey: "technician_name",   prevId: existing.technician_id,   prevName: existing.technician_name,   label: "فني أساسي" },
    { idKey: "technician_2_id", nameKey: "technician_2_name", prevId: existing.technician_2_id, prevName: existing.technician_2_name, label: "فني ثاني" },
  ] as const) {
    if (slot.idKey in b) {
      const newId = (b as Record<string, unknown>)[slot.idKey] ? Number((b as Record<string, unknown>)[slot.idKey]) : null;
      if (newId !== slot.prevId) {
        await db.insert(repairStatusHistoryTable).values({
          job_id: id,
          company_id,
          technician_id: newId,
          technician_name: (b as Record<string, unknown>)[slot.nameKey] as string ?? null,
          user_id,
          user_name,
          event_type: "technician_change",
          note: `تغيير ${slot.label}: ${slot.prevName ?? "—"} → ${(b as Record<string, unknown>)[slot.nameKey] ?? "—"}`,
        });
        if (newId) {
          await notifyUser(company_id, newId, {
            type: "repair_assigned",
            title: "تم تعيينك على بطاقة صيانة",
            message: `بطاقة ${existing.job_no} — ${existing.device_brand} ${existing.device_model}`,
            link: `/repairs?job=${id}`,
            reference_id: id,
          });
        }
      }
    }
  }

  if (b.report_note) {
    await db.insert(repairStatusHistoryTable).values({
      job_id: id,
      company_id,
      user_id,
      user_name,
      event_type: "report",
      note: String(b.report_note),
    });
  }

  return res.json(updated);
}));

/* ══════════════════════════════════════════════════════════════
   DELETE REPAIR JOB
   ══════════════════════════════════════════════════════════════ */
router.delete("/repair-jobs/:id", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_repairs")) {
    return res.status(403).json({ error: "غير مصرح بحذف بطاقات الصيانة" });
  }
  const { company_id, user_id, user_name } = ctx(req);
  const id = Number(req.params.id);
  const [job] = await db.select({ id: repairJobsTable.id, job_no: repairJobsTable.job_no })
    .from(repairJobsTable)
    .where(and(eq(repairJobsTable.id, id), eq(repairJobsTable.company_id, company_id)))
    .limit(1);
  if (!job) return res.status(404).json({ error: "غير موجود" });
  await db.transaction(async (tx) => {
    await tx.delete(repairJobPartsTable).where(eq(repairJobPartsTable.job_id, job.id));
    await tx.delete(repairStatusHistoryTable).where(eq(repairStatusHistoryTable.job_id, job.id));
    await tx.delete(repairJobsTable)
      .where(and(eq(repairJobsTable.id, job.id), eq(repairJobsTable.company_id, company_id)));
  });
  void writeAuditLog({
    action: "delete",
    record_type: "repair_job",
    record_id: id,
    old_value: { job_no: job.job_no },
    user: { id: user_id, username: user_name },
    company_id,
  });
  return res.json({ ok: true });
}));

/* ══════════════════════════════════════════════════════════════
   ENGINEER REPORTS
   ══════════════════════════════════════════════════════════════ */
router.get("/repair-jobs/:id/engineer-reports", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_repairs")) {
    return res.status(403).json({ error: "غير مصرح بعرض تقارير المهندسين" });
  }
  const { company_id } = ctx(req);
  const job_id = Number(req.params.id);
  const rows = await db.select().from(repairStatusHistoryTable)
    .where(and(
      eq(repairStatusHistoryTable.job_id, job_id),
      eq(repairStatusHistoryTable.company_id, company_id),
      eq(repairStatusHistoryTable.event_type, "engineer_report"),
    ))
    .orderBy(desc(repairStatusHistoryTable.created_at));
  return res.json(rows);
}));

router.post("/repair-jobs/:id/engineer-reports", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_repairs")) {
    return res.status(403).json({ error: "غير مصرح بإضافة تقارير المهندسين" });
  }
  const { company_id, user_id, user_name } = ctx(req);
  const job_id = Number(req.params.id);
  const note = String((req.body as Record<string, unknown>).note ?? "").trim();
  if (!note) return res.status(400).json({ error: "نص التقرير مطلوب" });
  if (note.length > MAX_ENGINEER_REPORT_LEN)
    return res.status(400).json({ error: `نص التقرير لا يجب أن يتجاوز ${MAX_ENGINEER_REPORT_LEN} حرف` });

  const [job] = await db.select({
    id: repairJobsTable.id,
    technician_id: repairJobsTable.technician_id,
    technician_name: repairJobsTable.technician_name,
  }).from(repairJobsTable)
    .where(and(eq(repairJobsTable.id, job_id), eq(repairJobsTable.company_id, company_id)));
  if (!job) return res.status(404).json({ error: "بطاقة الصيانة غير موجودة" });

  const [row] = await db.insert(repairStatusHistoryTable).values({
    job_id,
    company_id,
    event_type:      "engineer_report",
    note,
    user_id,
    user_name,
    technician_id:   job.technician_id ?? null,
    technician_name: job.technician_name ?? null,
  }).returning();
  void writeAuditLog({
    action: "create",
    record_type: "repair_job",
    record_id: job_id,
    new_value: { event_type: "engineer_report", note_length: note.length },
    user: { id: user_id, username: user_name },
    company_id,
  });
  return res.status(201).json(row);
}));

router.delete("/repair-jobs/:id/engineer-reports/:rid", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_repairs")) {
    return res.status(403).json({ error: "غير مصرح بحذف تقارير المهندسين" });
  }
  const { company_id, user_id, user_name } = ctx(req);
  const job_id = Number(req.params.id);
  const rid = Number(req.params.rid);
  const [existing] = await db.select({ id: repairStatusHistoryTable.id })
    .from(repairStatusHistoryTable)
    .where(and(
      eq(repairStatusHistoryTable.id, rid),
      eq(repairStatusHistoryTable.company_id, company_id),
      eq(repairStatusHistoryTable.event_type, "engineer_report"),
    ))
    .limit(1);
  if (!existing) return res.status(404).json({ error: "التقرير غير موجود" });

  await db.delete(repairStatusHistoryTable)
    .where(and(
      eq(repairStatusHistoryTable.id, rid),
      eq(repairStatusHistoryTable.company_id, company_id),
      eq(repairStatusHistoryTable.event_type, "engineer_report"),
    ));
  void writeAuditLog({
    action: "delete",
    record_type: "repair_job",
    record_id: job_id,
    old_value: { engineer_report_id: rid },
    user: { id: user_id, username: user_name },
    company_id,
  });
  return res.json({ ok: true });
}));

/* ══════════════════════════════════════════════════════════════
   REPAIR CUSTOMERS
   ══════════════════════════════════════════════════════════════ */
router.get("/repair-customers/lookup", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_repairs")) {
    return res.status(403).json({ error: "غير مصرح" });
  }
  const { company_id } = ctx(req);
  const phone = String(req.query.phone ?? "").trim();
  if (!phone) return res.json(null);
  const rows = await db.execute(sql`
    SELECT id, name, phone FROM customers
    WHERE company_id = ${company_id} AND phone = ${phone}
    LIMIT 1
  `);
  const row = (rows.rows as Record<string, unknown>[])[0];
  return res.json(row ?? null);
}));

router.post("/repair-customers", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_repairs")) {
    return res.status(403).json({ error: "غير مصرح" });
  }
  const { company_id } = ctx(req);
  const b = req.body as Record<string, unknown>;
  const name  = String(b.name  ?? "").trim();
  const phone = String(b.phone ?? "").trim();
  if (!name)  return res.status(400).json({ error: "اسم العميل مطلوب" });
  if (!phone) return res.status(400).json({ error: "رقم الهاتف مطلوب" });

  const normalized = normalizeName(name);

  const dupName = await db.execute(sql`
    SELECT id, name FROM customers
    WHERE company_id = ${company_id} AND normalized_name = ${normalized}
    LIMIT 1
  `);
  if ((dupName.rows as unknown[]).length > 0) {
    const d = (dupName.rows as Record<string, unknown>[])[0];
    return res.status(400).json({ error: `يوجد عميل بنفس الاسم بالفعل: "${d.name}"`, existing: d });
  }

  const dupPhone = await db.execute(sql`
    SELECT id, name FROM customers WHERE company_id = ${company_id} AND phone = ${phone} LIMIT 1
  `);
  if ((dupPhone.rows as unknown[]).length > 0) {
    const d = (dupPhone.rows as Record<string, unknown>[])[0];
    return res.status(400).json({ error: `رقم الهاتف مستخدم بالفعل للعميل: "${d.name}"`, existing: d });
  }

  let attempts = 0;
  let inserted: Record<string, unknown> | null = null;
  let lastError: unknown = null;

  while (attempts < 5 && !inserted) {
    attempts++;
    const nextCode = await getNextCustomerCode();
    try {
      const result = await db.execute(sql`
        INSERT INTO customers (name, customer_code, normalized_name, phone, balance,
                               is_customer, is_supplier, source, company_id)
        VALUES (${name}, ${nextCode}, ${normalized}, ${phone}, 0,
                true, false, 'repair', ${company_id})
        RETURNING id, name, phone, customer_code
      `);
      inserted = (result.rows as Record<string, unknown>[])[0] ?? null;
    } catch (e: unknown) {
      lastError = e;
      const msg = String((e as { message?: string })?.message ?? "");
      if (!/customers_customer_code_unique|duplicate key/.test(msg)) throw e;
    }
  }

  if (!inserted) {
    return res.status(500).json({
      error: "تعذر توليد رقم عميل فريد، حاول مرة أخرى",
      details: String((lastError as { message?: string })?.message ?? ""),
    });
  }

  try {
    const acct = await getOrCreateCustomerAccount(
      Number(inserted.customer_code),
      name,
      company_id,
    );
    await db.execute(sql`
      UPDATE customers SET account_id = ${acct.id} WHERE id = ${Number(inserted.id)}
    `);
  } catch {
    /* non-fatal */
  }

  return res.status(201).json(inserted);
}));

export default router;
