import { Router, type IRouter } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  db,
  repairJobsTable,
  repairJobPartsTable,
  repairStatusesTable,
  repairChecklistItemsTable,
  repairStatusHistoryTable,
  scrapItemsTable,
  erpUsersTable,
} from "@workspace/db";
import { wrap } from "../lib/async-handler";
import { notifyUser } from "../lib/notify";

const router: IRouter = Router();

/* ── helpers ───────────────────────────────────────────────── */
function ctx(req: Express.Request) {
  const u = (req as unknown as { user: { company_id: number; id: number; name: string } }).user;
  return { company_id: u.company_id, user_id: u.id, user_name: u.name };
}

async function nextJobNo(companyId: number): Promise<string> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(repairJobsTable)
    .where(eq(repairJobsTable.company_id, companyId));
  const n = (Number(result[0]?.count ?? 0) + 1).toString().padStart(4, "0");
  const year = new Date().getFullYear();
  return `REP-${year}-${n}`;
}

const SYSTEM_STATUSES = [
  { key: "pending",       label_ar: "في الانتظار",     color: "#f59e0b", sort_order: 1 },
  { key: "diagnosing",    label_ar: "قيد الفحص",       color: "#3b82f6", sort_order: 2 },
  { key: "in_progress",   label_ar: "قيد الإصلاح",     color: "#8b5cf6", sort_order: 3 },
  { key: "waiting_parts", label_ar: "بانتظار قطعة",    color: "#ec4899", sort_order: 4 },
  { key: "qa",            label_ar: "اختبار الجودة",   color: "#06b6d4", sort_order: 5 },
  { key: "done",          label_ar: "تم الإصلاح",       color: "#10b981", sort_order: 6 },
  { key: "delivered",     label_ar: "تم التسليم",       color: "#14b8a6", sort_order: 7 },
  { key: "cancelled",     label_ar: "ملغي",             color: "#ef4444", sort_order: 8 },
];

const SYSTEM_CHECKLIST = [
  "الشاشة", "البطارية", "الكاميرا الأمامية", "الكاميرا الخلفية",
  "السماعة", "الميكروفون", "زر الباور", "زر الصوت",
  "البصمة / Face ID", "الواي فاي", "البلوتوث", "الشاحن / منفذ USB",
  "الهيكل الخارجي", "الشريحة / SIM",
];

async function ensureCompanyDefaults(companyId: number) {
  const existingStatuses = await db.select({ id: repairStatusesTable.id })
    .from(repairStatusesTable)
    .where(eq(repairStatusesTable.company_id, companyId))
    .limit(1);
  if (existingStatuses.length === 0) {
    await db.insert(repairStatusesTable).values(
      SYSTEM_STATUSES.map(s => ({ ...s, company_id: companyId, is_system: true }))
    );
  }
  const existingChecklist = await db.select({ id: repairChecklistItemsTable.id })
    .from(repairChecklistItemsTable)
    .where(eq(repairChecklistItemsTable.company_id, companyId))
    .limit(1);
  if (existingChecklist.length === 0) {
    await db.insert(repairChecklistItemsTable).values(
      SYSTEM_CHECKLIST.map((label, i) => ({
        company_id: companyId,
        label_ar: label,
        sort_order: i + 1,
        is_system: true,
      }))
    );
  }
}

/* ══════════════════════════════════════════════════════════════
   STATUSES (custom per company)
   ══════════════════════════════════════════════════════════════ */
router.get("/repair-statuses", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  await ensureCompanyDefaults(company_id);
  const rows = await db.select().from(repairStatusesTable)
    .where(eq(repairStatusesTable.company_id, company_id))
    .orderBy(repairStatusesTable.sort_order);
  return res.json(rows);
}));

router.post("/repair-statuses", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const b = req.body as Record<string, unknown>;
  const label = String(b.label_ar ?? "").trim();
  if (!label) return res.status(400).json({ error: "الاسم مطلوب" });
  const key = String(b.key ?? `custom_${Date.now()}`).trim();
  const [row] = await db.insert(repairStatusesTable).values({
    company_id,
    key,
    label_ar: label,
    color: String(b.color ?? "#64748b"),
    sort_order: Number(b.sort_order ?? 99),
    is_system: false,
  }).returning();
  return res.status(201).json(row);
}));

router.patch("/repair-statuses/:id", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const id = Number(req.params.id);
  const b = req.body as Record<string, unknown>;
  const updates: Record<string, unknown> = {};
  if ("label_ar" in b)   updates.label_ar = String(b.label_ar);
  if ("color" in b)      updates.color = String(b.color);
  if ("sort_order" in b) updates.sort_order = Number(b.sort_order);
  const [row] = await db.update(repairStatusesTable).set(updates)
    .where(and(eq(repairStatusesTable.id, id), eq(repairStatusesTable.company_id, company_id)))
    .returning();
  if (!row) return res.status(404).json({ error: "غير موجود" });
  return res.json(row);
}));

router.delete("/repair-statuses/:id", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const id = Number(req.params.id);
  const [s] = await db.select().from(repairStatusesTable)
    .where(and(eq(repairStatusesTable.id, id), eq(repairStatusesTable.company_id, company_id)));
  if (!s) return res.status(404).json({ error: "غير موجود" });
  if (s.is_system) return res.status(400).json({ error: "لا يمكن حذف حالة النظام" });
  await db.delete(repairStatusesTable)
    .where(and(eq(repairStatusesTable.id, id), eq(repairStatusesTable.company_id, company_id)));
  return res.json({ ok: true });
}));

/* ══════════════════════════════════════════════════════════════
   CHECKLIST ITEMS (custom per company)
   ══════════════════════════════════════════════════════════════ */
router.get("/repair-checklist-items", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  await ensureCompanyDefaults(company_id);
  const rows = await db.select().from(repairChecklistItemsTable)
    .where(eq(repairChecklistItemsTable.company_id, company_id))
    .orderBy(repairChecklistItemsTable.sort_order);
  return res.json(rows);
}));

router.post("/repair-checklist-items", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const b = req.body as Record<string, unknown>;
  const label = String(b.label_ar ?? "").trim();
  if (!label) return res.status(400).json({ error: "الاسم مطلوب" });
  const category = String(b.category ?? "عام").trim() || "عام";
  // Max sort_order in same category
  const existing = await db.select({ s: repairChecklistItemsTable.sort_order })
    .from(repairChecklistItemsTable)
    .where(and(
      eq(repairChecklistItemsTable.company_id, company_id),
      eq(repairChecklistItemsTable.category, category),
    ))
    .orderBy(desc(repairChecklistItemsTable.sort_order))
    .limit(1);
  const nextOrder = (existing[0]?.s ?? 0) + 1;
  const [row] = await db.insert(repairChecklistItemsTable).values({
    company_id,
    label_ar: label,
    category,
    sort_order: nextOrder,
    is_system: false,
  }).returning();
  return res.status(201).json(row);
}));

router.patch("/repair-checklist-items/:id", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const id = Number(req.params.id);
  const b = req.body as Record<string, unknown>;
  const updates: Record<string, unknown> = {};
  if ("label_ar" in b)   updates.label_ar   = String(b.label_ar);
  if ("sort_order" in b) updates.sort_order  = Number(b.sort_order);
  if ("category" in b)   updates.category    = String(b.category).trim() || "عام";
  const [row] = await db.update(repairChecklistItemsTable).set(updates)
    .where(and(eq(repairChecklistItemsTable.id, id), eq(repairChecklistItemsTable.company_id, company_id)))
    .returning();
  if (!row) return res.status(404).json({ error: "غير موجود" });
  return res.json(row);
}));

/* Bulk reorder: [{ id, sort_order }] */
router.post("/repair-checklist-items/reorder", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const items = req.body as { id: number; sort_order: number }[];
  if (!Array.isArray(items)) return res.status(400).json({ error: "invalid" });
  await Promise.all(items.map(({ id, sort_order }) =>
    db.update(repairChecklistItemsTable)
      .set({ sort_order })
      .where(and(eq(repairChecklistItemsTable.id, id), eq(repairChecklistItemsTable.company_id, company_id)))
  ));
  return res.json({ ok: true });
}));

router.delete("/repair-checklist-items/:id", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const id = Number(req.params.id);
  await db.delete(repairChecklistItemsTable)
    .where(and(eq(repairChecklistItemsTable.id, id), eq(repairChecklistItemsTable.company_id, company_id)));
  return res.json({ ok: true });
}));

/* ══════════════════════════════════════════════════════════════
   REPAIR JOBS
   ══════════════════════════════════════════════════════════════ */
router.get("/repair-jobs", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const { status, technician_id, search } = req.query as Record<string, string>;

  const conds = [eq(repairJobsTable.company_id, company_id)];
  if (status && status !== "all") conds.push(eq(repairJobsTable.status, status));
  if (technician_id && technician_id !== "all") {
    const tid = Number(technician_id);
    conds.push(sql`(${repairJobsTable.technician_id} = ${tid} OR ${repairJobsTable.technician_2_id} = ${tid})`);
  }

  const jobs = await db.select().from(repairJobsTable)
    .where(and(...conds))
    .orderBy(desc(repairJobsTable.created_at));

  let filtered = jobs;
  if (search?.trim()) {
    const s = search.trim().toLowerCase();
    filtered = jobs.filter(j =>
      j.customer_name.toLowerCase().includes(s) ||
      j.device_model.toLowerCase().includes(s) ||
      j.device_brand.toLowerCase().includes(s) ||
      j.job_no.toLowerCase().includes(s) ||
      (j.imei && j.imei.toLowerCase().includes(s)) ||
      (j.serial_no && j.serial_no.toLowerCase().includes(s)) ||
      (j.customer_phone && j.customer_phone.includes(s)) ||
      (j.technician_name && j.technician_name.toLowerCase().includes(s)) ||
      (j.technician_2_name && j.technician_2_name.toLowerCase().includes(s))
    );
  }
  return res.json(filtered);
}));

/* Stats by status (with colors) for dashboard cards */
router.get("/repair-jobs/stats", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  await ensureCompanyDefaults(company_id);

  const rows = await db.select({
    status: repairJobsTable.status,
    count: sql<number>`count(*)`,
  }).from(repairJobsTable)
    .where(eq(repairJobsTable.company_id, company_id))
    .groupBy(repairJobsTable.status);

  const statusDefs = await db.select().from(repairStatusesTable)
    .where(eq(repairStatusesTable.company_id, company_id))
    .orderBy(repairStatusesTable.sort_order);

  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.status] = Number(r.count);

  const today = new Date(); today.setHours(0,0,0,0);
  const todayJobs = await db.select({ count: sql<number>`count(*)` })
    .from(repairJobsTable)
    .where(and(
      eq(repairJobsTable.company_id, company_id),
      sql`${repairJobsTable.created_at} >= ${today.toISOString()}`
    ));

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return res.json({
    total,
    today_count: Number(todayJobs[0]?.count ?? 0),
    pending:     counts["pending"] ?? 0,
    in_progress: counts["in_progress"] ?? 0,
    done:        counts["done"] ?? 0,
    delivered:   counts["delivered"] ?? 0,
    cancelled:   counts["cancelled"] ?? 0,
    by_status: statusDefs.map(s => ({
      key: s.key,
      label: s.label_ar,
      color: s.color,
      count: counts[s.key] ?? 0,
    })),
  });
}));

/* Long-stay alerts: jobs in repair center > N days, not delivered/cancelled */
router.get("/repair-jobs/alerts", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const days = Number(req.query.days ?? 7);
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
  const rows = await db.select().from(repairJobsTable)
    .where(and(
      eq(repairJobsTable.company_id, company_id),
      sql`${repairJobsTable.status} NOT IN ('delivered','cancelled')`,
      sql`${repairJobsTable.received_at} <= ${cutoff.toISOString().slice(0,10)}`
    ))
    .orderBy(repairJobsTable.received_at);
  return res.json(rows);
}));

/* Technicians list — kept for backward compat */
router.get("/repair-jobs/technicians", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const users = await db.select({ id: erpUsersTable.id, name: erpUsersTable.name })
    .from(erpUsersTable)
    .where(eq(erpUsersTable.company_id, company_id));
  return res.json(users);
}));

router.get("/repair-jobs/:id", wrap(async (req, res) => {
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

  return res.json({ ...job, parts, history });
}));

router.post("/repair-jobs", wrap(async (req, res) => {
  const { company_id, user_id, user_name } = ctx(req);
  const b = req.body as Record<string, unknown>;
  const job_no = await nextJobNo(company_id);

  const [job] = await db.insert(repairJobsTable).values({
    company_id,
    job_no,
    customer_name:        String(b.customer_name ?? ""),
    customer_phone:       b.customer_phone ? String(b.customer_phone) : null,
    customer_id:          b.customer_id ? Number(b.customer_id) : null,
    device_brand:         String(b.device_brand ?? ""),
    device_model:         String(b.device_model ?? ""),
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
    status:               "pending",
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
  }).returning();

  /* History entry */
  await db.insert(repairStatusHistoryTable).values({
    job_id: job.id,
    company_id,
    status_to: "pending",
    user_id,
    user_name,
    event_type: "created",
    note: "تم إنشاء بطاقة الصيانة",
  });

  /* Notify assigned technicians */
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

router.patch("/repair-jobs/:id", wrap(async (req, res) => {
  const { company_id, user_id, user_name } = ctx(req);
  const id = Number(req.params.id);
  const b = req.body as Record<string, unknown>;

  const [existing] = await db.select().from(repairJobsTable)
    .where(and(eq(repairJobsTable.id, id), eq(repairJobsTable.company_id, company_id)));
  if (!existing) return res.status(404).json({ error: "غير موجود" });
  if (existing.locked && !("locked" in b)) {
    return res.status(400).json({ error: "البطاقة مغلقة بعد التسليم — لا يمكن التعديل" });
  }

  const updates: Record<string, unknown> = { updated_at: new Date() };
  const FIELDS = [
    "status","technician_id","technician_name","technician_2_id","technician_2_name","technician_2_section",
    "problem_description","notes","imei","serial_no","color","storage",
    "estimated_delivery","external_workshop","external_workshop_name",
    "broker_name","alert_days_threshold","qa_notes","locked",
  ];
  for (const f of FIELDS) if (f in b) updates[f] = (b as Record<string, unknown>)[f];

  const NUM = ["estimated_cost","final_cost","deposit_paid","external_workshop_cost","broker_commission"];
  for (const f of NUM) if (f in b) updates[f] = String((b as Record<string, unknown>)[f]);

  if ("device_score" in b) updates.device_score = b.device_score ? Number(b.device_score) : null;
  if ("checklist" in b)    updates.checklist = JSON.stringify(b.checklist);
  if ("qa_checklist" in b) {
    updates.qa_checklist = JSON.stringify(b.qa_checklist);
    updates.qa_completed_at = new Date();
  }
  if (b.status === "delivered") {
    updates.delivered_at = new Date().toISOString().split("T")[0];
    updates.locked = true;
  }

  const [updated] = await db.update(repairJobsTable).set(updates)
    .where(and(eq(repairJobsTable.id, id), eq(repairJobsTable.company_id, company_id)))
    .returning();

  /* History on status change */
  if (b.status && b.status !== existing.status) {
    await db.insert(repairStatusHistoryTable).values({
      job_id: id,
      company_id,
      status_from: existing.status,
      status_to: String(b.status),
      user_id,
      user_name,
      event_type: "status_change",
      note: b.status_note ? String(b.status_note) : null,
    });
  }

  /* History on technician change + notify */
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

  /* History on report/notes */
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

router.delete("/repair-jobs/:id", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const id = Number(req.params.id);
  const [job] = await db.select({ id: repairJobsTable.id }).from(repairJobsTable)
    .where(and(eq(repairJobsTable.id, id), eq(repairJobsTable.company_id, company_id)))
    .limit(1);
  if (!job) return res.status(404).json({ error: "غير موجود" });
  await db.transaction(async (tx) => {
    await tx.delete(repairJobPartsTable).where(eq(repairJobPartsTable.job_id, job.id));
    await tx.delete(repairStatusHistoryTable).where(eq(repairStatusHistoryTable.job_id, job.id));
    await tx.delete(repairJobsTable)
      .where(and(eq(repairJobsTable.id, job.id), eq(repairJobsTable.company_id, company_id)));
  });
  return res.json({ ok: true });
}));

/* ── PARTS ─────────────────────────────────────────────────── */
router.post("/repair-jobs/:id/parts", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const job_id = Number(req.params.id);
  const b = req.body as Record<string, unknown>;
  const [part] = await db.insert(repairJobPartsTable).values({
    job_id,
    company_id,
    product_id:    b.product_id ? Number(b.product_id) : null,
    product_name:  String(b.product_name ?? ""),
    quantity:      String(b.quantity ?? "1"),
    unit_price:    String(b.unit_price ?? "0"),
    source:        String(b.source ?? "internal"),
    warehouse_id:  b.warehouse_id ? Number(b.warehouse_id) : null,
  }).returning();
  return res.status(201).json(part);
}));

router.delete("/repair-jobs/:id/parts/:partId", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const partId = Number(req.params.partId);
  await db.delete(repairJobPartsTable)
    .where(and(eq(repairJobPartsTable.id, partId), eq(repairJobPartsTable.company_id, company_id)));
  return res.json({ ok: true });
}));

/* Return part to stock or scrap (for repair returns) */
router.post("/repair-jobs/:id/parts/:partId/return", wrap(async (req, res) => {
  const { company_id, user_id, user_name } = ctx(req);
  const partId = Number(req.params.partId);
  const b = req.body as Record<string, unknown>;
  const dest = String(b.destination ?? "stock"); // 'stock' | 'scrap'

  const [part] = await db.select().from(repairJobPartsTable)
    .where(and(eq(repairJobPartsTable.id, partId), eq(repairJobPartsTable.company_id, company_id)));
  if (!part) return res.status(404).json({ error: "القطعة غير موجودة" });
  if (part.is_returned) return res.status(400).json({ error: "تم إرجاعها بالفعل" });

  await db.update(repairJobPartsTable).set({
    is_returned: true,
    return_destination: dest,
    returned_at: new Date(),
  }).where(eq(repairJobPartsTable.id, partId));

  if (dest === "scrap") {
    await db.insert(scrapItemsTable).values({
      company_id,
      product_id: part.product_id,
      product_name: part.product_name,
      quantity: part.quantity,
      unit_cost: part.unit_price,
      warehouse_id: part.warehouse_id,
      reason: String(b.reason ?? "إرجاع من صيانة - تالفة"),
      source_type: "repair_return",
      source_id: part.job_id,
      created_by: user_id,
      created_by_name: user_name,
    });
  }

  return res.json({ ok: true });
}));

/* ══════════════════════════════════════════════════════════════
   QUICK CUSTOMER CREATION (from repair form)
   Creates a customer tagged source='repair'. No can_manage_customers
   permission required — anyone who can create repair jobs can add
   a walk-in repair customer.
══════════════════════════════════════════════════════════════ */
router.get("/repair-customers/lookup", wrap(async (req, res) => {
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
  const { company_id } = ctx(req);
  const b = req.body as Record<string, unknown>;
  const name  = String(b.name  ?? "").trim();
  const phone = String(b.phone ?? "").trim();
  if (!name)  return res.status(400).json({ error: "اسم العميل مطلوب" });
  if (!phone) return res.status(400).json({ error: "رقم الهاتف مطلوب" });

  /* Duplicate phone check */
  const dup = await db.execute(sql`
    SELECT id, name FROM customers WHERE company_id = ${company_id} AND phone = ${phone} LIMIT 1
  `);
  if ((dup.rows as unknown[]).length > 0) {
    const d = (dup.rows as Record<string, unknown>[])[0];
    return res.status(400).json({ error: `رقم الهاتف مستخدم بالفعل للعميل: "${d.name}"`, existing: d });
  }

  /* Next customer code */
  const codeRows = await db.execute(sql`
    SELECT COALESCE(MAX(customer_code), 1000) + 1 AS next_code FROM customers WHERE company_id = ${company_id}
  `);
  const nextCode = Number((codeRows.rows as Record<string, unknown>[])[0]?.next_code ?? 1001);

  const result = await db.execute(sql`
    INSERT INTO customers (name, customer_code, phone, balance, is_customer, is_supplier, source, company_id)
    VALUES (${name}, ${nextCode}, ${phone}, 0, true, false, 'repair', ${company_id})
    RETURNING id, name, phone, customer_code
  `);
  const row = (result.rows as Record<string, unknown>[])[0];
  return res.status(201).json(row);
}));

export default router;
