import { Router, type IRouter } from "express";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import {
  db,
  repairJobsTable,
  repairJobPartsTable,
  repairStatusesTable,
  repairChecklistItemsTable,
  repairDeviceModelsTable,
  repairStatusHistoryTable,
  erpUsersTable,
} from "@workspace/db";
import { wrap } from "../../lib/async-handler";
import { notifyUser } from "../../lib/notify";
import { hasPermission } from "../../lib/permissions";
import { computeTrackingToken } from "../../lib/tracking-token";
import { validateTransition } from "../../services/repair-pipeline.service";
import { writeAuditLog } from "../../lib/audit-log";
import { normalizeName, getNextCustomerCode } from "../customers";
import { getOrCreateCustomerAccount } from "../../lib/auto-account";
import { findOrCreateCustomerByPhone } from "../../lib/auto-customer";
import {
  ctx,
  nextJobNo,
  ensureCompanyDefaults,
  VALID_DEVICE_TYPES,
  type DeviceType,
  MAX_ENGINEER_REPORT_LEN,
  SEED_TEMPLATES,
  createRepairStatusSchema,
  updateRepairStatusSchema,
  createChecklistItemSchema,
  createRepairJobSchema,
} from "./_shared";

const router: IRouter = Router();

/* ══════════════════════════════════════════════════════════════
   STATUSES (custom per company)
   ══════════════════════════════════════════════════════════════ */
router.get("/repair-statuses", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_repairs")) {
    return res.status(403).json({ error: "غير مصرح" });
  }
  const { company_id } = ctx(req);
  await ensureCompanyDefaults(company_id);
  const rows = await db.select().from(repairStatusesTable)
    .where(eq(repairStatusesTable.company_id, company_id))
    .orderBy(repairStatusesTable.sort_order);
  return res.json(rows);
}));

router.post("/repair-statuses", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_repairs")) {
    return res.status(403).json({ error: "غير مصرح" });
  }
  const { company_id } = ctx(req);
  const v = createRepairStatusSchema.safeParse(req.body);
  if (!v.success) return res.status(400).json({ error: v.error.errors[0]?.message ?? "بيانات غير صالحة" });
  const { label_ar, key: rawKey, color, sort_order } = v.data;
  const key = rawKey ?? `custom_${Date.now()}`;
  const [row] = await db.insert(repairStatusesTable).values({
    company_id,
    key,
    label_ar,
    color: color ?? "#64748b",
    sort_order: sort_order ?? 99,
    is_system: false,
  }).returning();
  return res.status(201).json(row);
}));

router.patch("/repair-statuses/:id", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_repairs")) {
    return res.status(403).json({ error: "غير مصرح" });
  }
  const { company_id } = ctx(req);
  const id = Number(req.params.id);
  const v = updateRepairStatusSchema.safeParse(req.body);
  if (!v.success) return res.status(400).json({ error: v.error.errors[0]?.message ?? "بيانات غير صالحة" });
  const { label_ar, color, sort_order } = v.data;
  const updates: Record<string, unknown> = {};
  if (label_ar   !== undefined) updates.label_ar   = label_ar;
  if (color      !== undefined) updates.color      = color;
  if (sort_order !== undefined) updates.sort_order = sort_order;
  const [row] = await db.update(repairStatusesTable).set(updates)
    .where(and(eq(repairStatusesTable.id, id), eq(repairStatusesTable.company_id, company_id)))
    .returning();
  if (!row) return res.status(404).json({ error: "غير موجود" });
  return res.json(row);
}));

router.delete("/repair-statuses/:id", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_repairs")) {
    return res.status(403).json({ error: "غير مصرح" });
  }
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
  if (!hasPermission(req.user, "can_view_repairs")) {
    return res.status(403).json({ error: "غير مصرح" });
  }
  const { company_id } = ctx(req);
  await ensureCompanyDefaults(company_id);
  const deviceType = req.query.device_type as string | undefined;
  const where = deviceType
    ? and(eq(repairChecklistItemsTable.company_id, company_id), eq(repairChecklistItemsTable.device_type, deviceType))
    : eq(repairChecklistItemsTable.company_id, company_id);
  const rows = await db.select().from(repairChecklistItemsTable)
    .where(where)
    .orderBy(repairChecklistItemsTable.sort_order);
  return res.json(rows);
}));

router.post("/repair-checklist-items", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_repairs")) {
    return res.status(403).json({ error: "غير مصرح" });
  }
  const { company_id } = ctx(req);
  const v = createChecklistItemSchema.safeParse(req.body);
  if (!v.success) return res.status(400).json({ error: v.error.errors[0]?.message ?? "بيانات غير صالحة" });
  const { label_ar: label, device_type: rawDeviceType, sort_order: _sort_order } = v.data;
  const b = req.body as Record<string, unknown>;
  const category = String(b.category ?? "عام").trim() || "عام";
  const device_type = rawDeviceType ?? (String(b.device_type ?? "general").trim() || "general");
  const existing = await db.select({ s: repairChecklistItemsTable.sort_order })
    .from(repairChecklistItemsTable)
    .where(and(
      eq(repairChecklistItemsTable.company_id, company_id),
      eq(repairChecklistItemsTable.category, category),
      eq(repairChecklistItemsTable.device_type, device_type),
    ))
    .orderBy(desc(repairChecklistItemsTable.sort_order))
    .limit(1);
  const nextOrder = (existing[0]?.s ?? 0) + 1;
  const [row] = await db.insert(repairChecklistItemsTable).values({
    company_id,
    label_ar: label,
    category,
    device_type,
    sort_order: nextOrder,
    is_system: false,
  }).returning();
  return res.status(201).json(row);
}));

/* Seed all items for a specific device type (iphone | ipad | watch | airpods | mac | samsung_phone | etc.) */
router.post("/repair-checklist-items/seed-device-type", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_repairs")) {
    return res.status(403).json({ error: "غير مصرح" });
  }
  const { company_id } = ctx(req);
  const { device_type } = req.body as { device_type: string };
  // eslint-disable-next-line security/detect-object-injection
  const template = SEED_TEMPLATES[device_type];
  if (!template) return res.status(400).json({ error: "device_type غير معروف" });

  /* Check if already seeded */
  const existing = await db.select({ id: repairChecklistItemsTable.id })
    .from(repairChecklistItemsTable)
    .where(and(
      eq(repairChecklistItemsTable.company_id, company_id),
      eq(repairChecklistItemsTable.device_type, device_type),
    ))
    .limit(1);
  if (existing.length > 0) return res.status(409).json({ error: "already_seeded" });

  /* Insert all at once with sort_order by category group */
  const catOrder: Record<string, number> = {};
  const rows = template.map((item) => {
    catOrder[item.category] = (catOrder[item.category] ?? 0) + 1;
    return {
      company_id,
      label_ar: item.label_ar,
      category: item.category,
      device_type,
      sort_order: catOrder[item.category],
      is_system: true,
    };
  });
  await db.insert(repairChecklistItemsTable).values(rows);
  return res.json({ ok: true, count: rows.length });
}));

/* Copy checklist items from one device type to another (e.g. derive AirPods from iPhone) */
router.post("/repair-checklist-items/copy", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_repairs")) {
    return res.status(403).json({ error: "غير مصرح" });
  }
  const { company_id } = ctx(req);
  const { from, to } = req.body as { from: string; to: string };
  if (!from || !to || from === to) return res.status(400).json({ error: "from/to invalid" });
  if (!VALID_DEVICE_TYPES.includes(to as DeviceType)) return res.status(400).json({ error: "to غير معروف" });

  const sourceItems = await db.select().from(repairChecklistItemsTable)
    .where(and(eq(repairChecklistItemsTable.company_id, company_id), eq(repairChecklistItemsTable.device_type, from)));
  if (sourceItems.length === 0) return res.status(404).json({ error: "لا توجد بنود في النوع المصدر" });

  const existingTarget = await db.select({ id: repairChecklistItemsTable.id })
    .from(repairChecklistItemsTable)
    .where(and(eq(repairChecklistItemsTable.company_id, company_id), eq(repairChecklistItemsTable.device_type, to)))
    .limit(1);
  if (existingTarget.length > 0) return res.status(409).json({ error: "already_has_items" });

  const rows = sourceItems.map((s) => ({
    company_id,
    label_ar: s.label_ar,
    category: s.category ?? "عام",
    device_type: to,
    sort_order: s.sort_order ?? 0,
    is_system: false,
  }));
  await db.insert(repairChecklistItemsTable).values(rows);
  return res.json({ ok: true, count: rows.length });
}));

router.patch("/repair-checklist-items/:id", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_repairs")) {
    return res.status(403).json({ error: "غير مصرح" });
  }
  const { company_id } = ctx(req);
  const id = Number(req.params.id);
  const b = req.body as Record<string, unknown>;
  const updates: Record<string, unknown> = {};
  if ("label_ar" in b)    updates.label_ar    = String(b.label_ar);
  if ("sort_order" in b)  updates.sort_order   = Number(b.sort_order);
  if ("category" in b)    updates.category     = String(b.category).trim() || "عام";
  if ("device_type" in b) updates.device_type  = String(b.device_type).trim() || "general";
  const [row] = await db.update(repairChecklistItemsTable).set(updates)
    .where(and(eq(repairChecklistItemsTable.id, id), eq(repairChecklistItemsTable.company_id, company_id)))
    .returning();
  if (!row) return res.status(404).json({ error: "غير موجود" });
  return res.json(row);
}));

/* Bulk reorder: [{ id, sort_order }] */
router.post("/repair-checklist-items/reorder", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_repairs")) {
    return res.status(403).json({ error: "غير مصرح" });
  }
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
  if (!hasPermission(req.user, "can_manage_repairs")) {
    return res.status(403).json({ error: "غير مصرح" });
  }
  const { company_id } = ctx(req);
  const id = Number(req.params.id);
  await db.delete(repairChecklistItemsTable)
    .where(and(eq(repairChecklistItemsTable.id, id), eq(repairChecklistItemsTable.company_id, company_id)));
  return res.json({ ok: true });
}));

/* ══════════════════════════════════════════════════════════════
   REPAIR DEVICE MODELS (custom models added by admin)
   ══════════════════════════════════════════════════════════════ */

router.get("/repair-device-models", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_repairs")) {
    return res.status(403).json({ error: "غير مصرح" });
  }
  const { company_id } = ctx(req);
  const rows = await db.select().from(repairDeviceModelsTable)
    .where(eq(repairDeviceModelsTable.company_id, company_id))
    .orderBy(repairDeviceModelsTable.brand, repairDeviceModelsTable.category, repairDeviceModelsTable.sort_order);
  return res.json(rows);
}));

router.post("/repair-device-models", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_repairs")) {
    return res.status(403).json({ error: "غير مصرح" });
  }
  const { company_id } = ctx(req);
  const { brand, category, model } = req.body as { brand: string; category: string; model: string };
  if (!brand?.trim() || !category?.trim() || !model?.trim()) {
    return res.status(400).json({ error: "brand, category, model مطلوبة" });
  }
  const existing = await db.select({ s: repairDeviceModelsTable.sort_order })
    .from(repairDeviceModelsTable)
    .where(and(eq(repairDeviceModelsTable.company_id, company_id), eq(repairDeviceModelsTable.brand, brand.trim()), eq(repairDeviceModelsTable.category, category.trim())))
    .orderBy(desc(repairDeviceModelsTable.sort_order)).limit(1);
  const nextOrder = (existing[0]?.s ?? -1) + 1;
  const [row] = await db.insert(repairDeviceModelsTable).values({
    company_id,
    brand:      brand.trim(),
    category:   category.trim(),
    model:      model.trim(),
    sort_order: nextOrder,
  }).returning();
  return res.status(201).json(row);
}));

router.delete("/repair-device-models/:id", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_repairs")) {
    return res.status(403).json({ error: "غير مصرح" });
  }
  const { company_id } = ctx(req);
  const id = Number(req.params.id);
  await db.delete(repairDeviceModelsTable)
    .where(and(eq(repairDeviceModelsTable.id, id), eq(repairDeviceModelsTable.company_id, company_id)));
  return res.json({ ok: true });
}));

/* ══════════════════════════════════════════════════════════════
   REPAIR JOBS
   ══════════════════════════════════════════════════════════════ */
router.get("/repair-jobs", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_repairs")) {
    return res.status(403).json({ error: "غير مصرح بعرض بطاقات الصيانة" });
  }
  const { company_id } = ctx(req);
  const { status, technician_id, search } = req.query as Record<string, string>;

  const conds = [eq(repairJobsTable.company_id, company_id)];
  if (status && status !== "all") {
    /* Support comma-separated for dashboard cards that group multiple statuses */
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
      // Numeric-only → exact match on job number suffix
      filtered = jobs.filter(j =>
        j.job_no.endsWith(`-${s}`) ||
        j.job_no.endsWith(`-${s.padStart(4, "0")}`)
      );
    } else {
      // General: name, model, brand, IMEI, serial, phone, technician
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

/* Stats by status (with colors) for dashboard cards */
router.get("/repair-jobs/stats", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_repairs")) {
    return res.status(403).json({ error: "غير مصرح بعرض إحصاءات الصيانة" });
  }
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
  if (!hasPermission(req.user, "can_view_repairs")) {
    return res.status(403).json({ error: "غير مصرح" });
  }
  const { company_id } = ctx(req);
  const days = Number(req.query.days ?? 7);
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
  const rows = await db.select().from(repairJobsTable)
    .where(and(
      eq(repairJobsTable.company_id, company_id),
      sql`${repairJobsTable.status} NOT IN ('delivered','cancelled')`,
      sql`${repairJobsTable.received_at} <= ${cutoff.toISOString().slice(0,10)}`
    ))
    .orderBy(repairJobsTable.received_at)
    .limit(200);
  return res.json(rows);
}));

/* Technicians list — kept for backward compat */
router.get("/repair-jobs/technicians", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_repairs")) {
    return res.status(403).json({ error: "غير مصرح" });
  }
  const { company_id } = ctx(req);
  const users = await db.select({ id: erpUsersTable.id, name: erpUsersTable.name })
    .from(erpUsersTable)
    .where(eq(erpUsersTable.company_id, company_id));
  return res.json(users);
}));

/**
 * GET /repair-jobs/technician-stats
 *
 * إحصاء أداء الفنيين للشركة الحالية:
 *   - total_jobs:      إجمالي البطاقات المُسنَدة (كفنّي أساسي أو ثاني)
 *   - delivered:       بطاقات تم تسليمها
 *   - avg_duration_days: متوسط مدة الإصلاح بالأيام (received_at → delivered_at)
 *   - active_jobs:     بطاقات لا تزال جارية
 *
 * ⚠ هذا الـ route لازم يكون قبل /repair-jobs/:id (وإلّا Express يَعتبر "technician-stats" قيمة لـ :id).
 */
router.get("/repair-jobs/technician-stats", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_repairs")) {
    return res.status(403).json({ error: "غير مصرح بعرض إحصاءات الفنيين" });
  }
  const { company_id } = ctx(req);

  /* استعلام واحد لكل فنّي — يحسب البطاقات حيث الفني الأساسي يتطابق
     (مع الإشارة إلى أنّنا لا نُكرّر الحساب عبر technician_2_id لتفادي الازدواج). */
  const rows = await db.execute(sql`
    SELECT
      u.id          AS technician_id,
      u.name        AS technician_name,
      COUNT(j.id)::int                                              AS total_jobs,
      COUNT(j.id) FILTER (WHERE j.status = 'delivered')::int         AS delivered,
      COUNT(j.id) FILTER (WHERE j.status NOT IN ('delivered','cancelled','rejected'))::int AS active_jobs,
      ROUND(AVG(
        EXTRACT(EPOCH FROM (j.delivered_at::timestamp - j.received_at::timestamp)) / 86400.0
      ) FILTER (WHERE j.delivered_at IS NOT NULL), 2)::float        AS avg_duration_days
    FROM erp_users u
    LEFT JOIN repair_jobs j
      ON j.company_id = u.company_id
     AND (j.technician_id = u.id OR j.technician_2_id = u.id)
    WHERE u.company_id = ${company_id}
    GROUP BY u.id, u.name
    HAVING COUNT(j.id) > 0
    ORDER BY total_jobs DESC, u.name ASC
  `);

  /* drizzle's execute() result has .rows for pg driver */
  const list = (rows as unknown as { rows: Array<Record<string, unknown>> }).rows ?? [];
  return res.json(list);
}));

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

  /* نلفّ كل العمليات في transaction واحدة حتى لا يبقى عميل يتيم لو فشل
   * إدراج البطاقة (atomicity). الإشعارات تُرسَل بعد الـ commit. */
  const job = await db.transaction(async (tx) => {
    /* 1) إيجاد/إنشاء عميل دائم تلقائياً */
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

    /* 2) إدراج البطاقة */
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

    /* 3) سجل الحالة */
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

  /* الإشعارات بعد الـ commit (لا تؤثر على atomicity) */
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
    /* SEC-GATE-001:
       لا نسمح للعميل بحقن حقول البوّابة (qa_completed_at / pre_delivery_reviewed_at /
       shipping_settled_at / delivery_receipt_sent_at) عبر body لتمرير validateTransition.
       هذه الحقول تُضبط حصراً من خلال الـ endpoints المخصّصة:
         POST /qa-checklist     → qa_completed_at
         POST /pre-delivery     → pre_delivery_reviewed_at
         POST /shipping         → shipping_settled_at
         POST /delivery-receipt → delivery_receipt_sent_at
       لذلك نقيّم الانتقال بناءً على بيانات الـ DB الموثوقة فقط. */
    const { allowed, errors } = validateTransition(
      existing.status,
      String(b.status),
      existing as Record<string, unknown>,
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
    /* SEC-001: تم حذف "locked" من هنا — يُضبط تلقائياً فقط عند التسليم
       ولا يجب السماح لأي مستخدم بفتح بطاقة مسلّمة يدوياً عبر الـ API */
    "accessories","branch_id","device_pin",
    "device_brand","device_model",
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
  if ("checklist" in b)    updates.checklist = JSON.stringify(b.checklist);
  if ("qa_checklist" in b) {
    /* SEC-GATE-002: نسمح بحفظ qa_checklist عبر PATCH العام (للتعديل اليدوي)
       لكن لا نضبط qa_completed_at — هذا الـ timestamp بوّابة، ويُضبط حصراً
       من POST /repair-jobs/:id/qa-checklist لمنع تجاوز فحص QC الإلزامي. */
    updates.qa_checklist = JSON.stringify(b.qa_checklist);
  }
  if (b.status === "ready_for_delivery") {
    /* GATE: لا يُسمح بالانتقال إلى "جاهز للتسليم" قبل إدخال التكلفة النهائية. */
    const incomingFinal = "final_cost" in updates ? Number(updates.final_cost ?? 0) : Number(existing.final_cost ?? 0);
    if (!Number.isFinite(incomingFinal) || incomingFinal <= 0) {
      return res.status(400).json({
        error: "يجب إدخال التكلفة النهائية (>0) قبل نقل البطاقة إلى \"جاهز للتسليم\"",
      });
    }
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
      event_type: "pipeline_transition",
      note: "انتقال تلقائي عبر Pipeline",
    });
    void writeAuditLog({
      action: "repair_status_change",
      record_type: "repair_job",
      record_id: id,
      old_value: { status: existing.status },
      new_value: { status: String(b.status) },
      user: { id: user_id, username: user_name },
      company_id,
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
  /* SEC-002: سجّل حذف بطاقة الصيانة في audit_log لضمان الأثر الجنائي */
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

/* ══ ENGINEER REPORTS ═══════════════════════════════════════
   Stored in repair_status_history with event_type="engineer_report"
   - GET     /repair-jobs/:id/engineer-reports
   - POST    /repair-jobs/:id/engineer-reports         body: { note }
   - DELETE  /repair-jobs/:id/engineer-reports/:rid
═══════════════════════════════════════════════════════════ */
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
  /* SEC-004: رفض النصوص التي تتجاوز الحد الأقصى لمنع إرهاق الخادم */
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
  /* SEC-006: سجّل إضافة التقرير في audit_log للأثر الجنائي */
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
  /* SEC-003: تحقق من وجود التقرير قبل الحذف لضمان company_id isolation */
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
  /* SEC-003: سجّل حذف التقرير في audit_log لضمان الأثر الجنائي */
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
   QUICK CUSTOMER CREATION (from repair form)
   Creates a customer tagged source='repair'. No can_manage_customers
   permission required — anyone who can create repair jobs can add
   a walk-in repair customer.
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

  /* Duplicate name check (within company) */
  const dupName = await db.execute(sql`
    SELECT id, name FROM customers
    WHERE company_id = ${company_id} AND normalized_name = ${normalized}
    LIMIT 1
  `);
  if ((dupName.rows as unknown[]).length > 0) {
    const d = (dupName.rows as Record<string, unknown>[])[0];
    return res.status(400).json({ error: `يوجد عميل بنفس الاسم بالفعل: "${d.name}"`, existing: d });
  }

  /* Duplicate phone check (within company) */
  const dupPhone = await db.execute(sql`
    SELECT id, name FROM customers WHERE company_id = ${company_id} AND phone = ${phone} LIMIT 1
  `);
  if ((dupPhone.rows as unknown[]).length > 0) {
    const d = (dupPhone.rows as Record<string, unknown>[])[0];
    return res.status(400).json({ error: `رقم الهاتف مستخدم بالفعل للعميل: "${d.name}"`, existing: d });
  }

  /* Globally-unique next customer_code (UNIQUE constraint is global across companies) */
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
      /* retry only on customer_code unique-collision */
      if (!/customers_customer_code_unique|duplicate key/.test(msg)) throw e;
    }
  }

  if (!inserted) {
    return res.status(500).json({
      error: "تعذر توليد رقم عميل فريد، حاول مرة أخرى",
      details: String((lastError as { message?: string })?.message ?? ""),
    });
  }

  /* Auto-create chart-of-accounts entry & link */
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
    /* non-fatal: customer is created, accounting link can be repaired later */
  }

  return res.status(201).json(inserted);
}));

/* ══════════════════════════════════════════════════════════════
   REPAIR TECHNICIAN REPORT — تقرير أداء الفنيين
══════════════════════════════════════════════════════════════ */

/* GET /api/repair-jobs/reports/technicians — أداء الفنيين */
router.get("/repair-jobs/reports/technicians", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_repairs")) {
    res.status(403).json({ error: "غير مصرح بعرض تقارير الفنيين" }); return;
  }
  const companyId = req.user!.company_id!;
  const { from, to } = req.query as { from?: string; to?: string };

  const conditions = [eq(repairJobsTable.company_id, companyId)];
  if (from) conditions.push(sql`${repairJobsTable.received_at} >= ${from}`);
  if (to)   conditions.push(sql`${repairJobsTable.received_at} <= ${to}`);

  const rows = await db.select({
    technician_id:   repairJobsTable.technician_id,
    technician_name: repairJobsTable.technician_name,
    total_jobs:      sql<number>`COUNT(*)`,
    delivered:       sql<number>`SUM(CASE WHEN ${repairJobsTable.status} = 'delivered' THEN 1 ELSE 0 END)`,
    in_progress:     sql<number>`SUM(CASE WHEN ${repairJobsTable.status} NOT IN ('delivered','cancelled') THEN 1 ELSE 0 END)`,
    cancelled:       sql<number>`SUM(CASE WHEN ${repairJobsTable.status} = 'cancelled' THEN 1 ELSE 0 END)`,
    total_revenue:   sql<number>`COALESCE(SUM(CASE WHEN ${repairJobsTable.status} = 'delivered' THEN CAST(${repairJobsTable.final_cost} AS numeric) ELSE 0 END), 0)`,
    total_collected: sql<number>`COALESCE(SUM(CAST(${repairJobsTable.deposit_paid} AS numeric)), 0)`,
    avg_cost:        sql<number>`COALESCE(AVG(CASE WHEN ${repairJobsTable.status} = 'delivered' THEN CAST(${repairJobsTable.final_cost} AS numeric) ELSE NULL END), 0)`,
  })
  .from(repairJobsTable)
  .where(and(...conditions))
  .groupBy(repairJobsTable.technician_id, repairJobsTable.technician_name)
  .orderBy(desc(sql`SUM(CASE WHEN ${repairJobsTable.status} = 'delivered' THEN 1 ELSE 0 END)`));

  res.json(rows);
}));

/* GET /api/repair-jobs/reports/revenue — إيرادات الصيانة للفترة */
router.get("/repair-jobs/reports/revenue", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_repairs")) {
    res.status(403).json({ error: "غير مصرح بعرض تقارير الإيرادات" }); return;
  }
  const companyId = req.user!.company_id!;
  const { from, to } = req.query as { from?: string; to?: string };

  const conditions = [
    eq(repairJobsTable.company_id, companyId),
    sql`${repairJobsTable.status} = 'delivered'`,
  ];
  if (from) conditions.push(sql`${repairJobsTable.delivered_at} >= ${from}`);
  if (to)   conditions.push(sql`${repairJobsTable.delivered_at} <= ${to}`);

  const [summary] = await db.select({
    total_jobs:          sql<number>`COUNT(*)`,
    gross_revenue:       sql<number>`COALESCE(SUM(CAST(${repairJobsTable.final_cost} AS numeric)), 0)`,
    total_collected:     sql<number>`COALESCE(SUM(CAST(${repairJobsTable.deposit_paid} AS numeric)), 0)`,
    total_external_cost: sql<number>`COALESCE(SUM(CAST(${repairJobsTable.external_workshop_cost} AS numeric)), 0)`,
    avg_revenue:         sql<number>`COALESCE(AVG(CAST(${repairJobsTable.final_cost} AS numeric)), 0)`,
  }).from(repairJobsTable).where(and(...conditions));

  /* جلب تكلفة قطع الغيار */
  const partsConds = [eq(repairJobPartsTable.company_id, companyId)];
  if (from || to) {
    partsConds.push(sql`${repairJobPartsTable.job_id} IN (
      SELECT id FROM repair_jobs WHERE company_id = ${companyId} AND status = 'delivered'
      ${from ? sql`AND delivered_at >= ${from}` : sql``}
      ${to   ? sql`AND delivered_at <= ${to}`   : sql``}
    )`);
  }
  const [partsRow] = await db.select({
    parts_cost: sql<number>`COALESCE(SUM(CAST(${repairJobPartsTable.unit_price} AS numeric) * CAST(${repairJobPartsTable.quantity} AS numeric)), 0)`,
  }).from(repairJobPartsTable).where(and(...partsConds));

  const grossRevenue   = Number(summary?.gross_revenue ?? 0);
  const partsCost      = Number(partsRow?.parts_cost ?? 0);
  const externalCost   = Number(summary?.total_external_cost ?? 0);
  const netProfit      = grossRevenue - partsCost - externalCost;

  res.json({
    total_jobs:      Number(summary?.total_jobs ?? 0),
    gross_revenue:   grossRevenue,
    total_collected: Number(summary?.total_collected ?? 0),
    parts_cost:      partsCost,
    external_cost:   externalCost,
    net_profit:      netProfit,
    avg_revenue:     Number(summary?.avg_revenue ?? 0),
  });
}));

export default router;
