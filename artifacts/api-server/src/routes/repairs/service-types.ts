import { Router } from "express";
import { eq, and, asc, sql } from "drizzle-orm";
import { z } from "zod";
import { db, repairServiceTypesTable, repairJobServicesTable } from "@workspace/db";
import { wrap } from "../../lib/async-handler";
import { hasPermission } from "../../lib/permissions";
import { ctx } from "./_shared";

const router = Router();

/* ── Zod schemas ─────────────────────────────────────────────── */
const createServiceTypeSchema = z.object({
  name_ar:          z.string().min(1, "اسم الخدمة مطلوب").max(120),
  commission_type:  z.enum(["profit_based", "amount_based", "fixed"]).optional().default("profit_based"),
  commission_value: z.number().min(0).optional().default(0),
  is_active:        z.boolean().optional().default(true),
  sort_order:       z.number().int().optional().default(0),
});

const updateServiceTypeSchema = z.object({
  name_ar:          z.string().min(1).max(120).optional(),
  commission_type:  z.enum(["profit_based", "amount_based", "fixed"]).optional(),
  commission_value: z.number().min(0).optional(),
  is_active:        z.boolean().optional(),
  sort_order:       z.number().int().optional(),
});

/* ── GET /api/repair-service-types ───────────────────────────── */
router.get("/repair-service-types", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const isManager = hasPermission(req.user, "can_manage_settings");

  const rows = await db
    .select()
    .from(repairServiceTypesTable)
    .where(eq(repairServiceTypesTable.company_id, company_id))
    .orderBy(asc(repairServiceTypesTable.sort_order), asc(repairServiceTypesTable.id));

  if (isManager) {
    res.json(rows);
  } else {
    /* المستخدمون غير المدراء (الفنيون وغيرهم) يحصلون على الاسم والحالة فقط */
    res.json(rows.map(r => ({ id: r.id, name_ar: r.name_ar, is_active: r.is_active })));
  }
}));

/* ── POST /api/repair-service-types ──────────────────────────── */
router.post("/repair-service-types", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  if (!hasPermission(req.user, "can_manage_settings")) {
    res.status(403).json({ error: "غير مصرح" }); return;
  }
  const v = createServiceTypeSchema.safeParse(req.body);
  if (!v.success) { res.status(400).json({ error: v.error.issues[0]?.message }); return; }

  const [row] = await db
    .insert(repairServiceTypesTable)
    .values({
      company_id,
      name_ar:          v.data.name_ar,
      commission_type:  v.data.commission_type,
      commission_value: String(v.data.commission_value),
      is_active:        v.data.is_active,
      sort_order:       v.data.sort_order,
    })
    .returning();
  res.status(201).json(row);
}));

/* ── PATCH /api/repair-service-types/:id ─────────────────────── */
router.patch("/repair-service-types/:id", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  if (!hasPermission(req.user, "can_manage_settings")) {
    res.status(403).json({ error: "غير مصرح" }); return;
  }
  const id = Number(req.params.id);
  const v = updateServiceTypeSchema.safeParse(req.body);
  if (!v.success) { res.status(400).json({ error: v.error.issues[0]?.message }); return; }

  const upd: Record<string, unknown> = {};
  if (v.data.name_ar          !== undefined) upd.name_ar          = v.data.name_ar;
  if (v.data.commission_type  !== undefined) upd.commission_type  = v.data.commission_type;
  if (v.data.commission_value !== undefined) upd.commission_value = String(v.data.commission_value);
  if (v.data.is_active        !== undefined) upd.is_active        = v.data.is_active;
  if (v.data.sort_order       !== undefined) upd.sort_order       = v.data.sort_order;

  const [row] = await db
    .update(repairServiceTypesTable)
    .set(upd)
    .where(and(
      eq(repairServiceTypesTable.id, id),
      eq(repairServiceTypesTable.company_id, company_id),
    ))
    .returning();
  if (!row) { res.status(404).json({ error: "نوع الخدمة غير موجود" }); return; }
  res.json(row);
}));

/* ── DELETE /api/repair-service-types/:id ────────────────────── */
router.delete("/repair-service-types/:id", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  if (!hasPermission(req.user, "can_manage_settings")) {
    res.status(403).json({ error: "غير مصرح" }); return;
  }
  const id = Number(req.params.id);

  /* فحص الارتباط بـ repair_job_services قبل الحذف */
  const [usageRow] = await db
    .select({ cnt: sql<number>`count(*)::int` })
    .from(repairJobServicesTable)
    .where(eq(repairJobServicesTable.service_type_id, id));

  if ((usageRow?.cnt ?? 0) > 0) {
    res.status(409).json({
      error: "لا يمكن حذف نوع خدمة مستخدم في بطاقات صيانة. قم بتعطيله بدلاً من ذلك.",
    });
    return;
  }

  await db
    .delete(repairServiceTypesTable)
    .where(and(
      eq(repairServiceTypesTable.id, id),
      eq(repairServiceTypesTable.company_id, company_id),
    ));
  res.json({ ok: true });
}));

export default router;
