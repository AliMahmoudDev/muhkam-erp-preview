/**
 * job-services.ts — بنود الخدمة لكل بطاقة صيانة
 *
 * Routes:
 *  GET    /api/repair-jobs/:id/services
 *  POST   /api/repair-jobs/:id/services
 *  PATCH  /api/repair-jobs/:id/services/:serviceId
 *  DELETE /api/repair-jobs/:id/services/:serviceId
 *  POST   /api/repair-jobs/:id/services/:serviceId/parts
 *  DELETE /api/repair-jobs/:id/services/:serviceId/parts/:partId
 *
 * TODO (Phase 2 — Discount & Commission):
 *   - service.amount لا يرتبط بالضرورة بـ final_cost
 *   - commission_computed يُكتب فقط عند التسليم (delivery route)
 *   - يجب النظر في خصومات البطاقة عند تحديد قاعدة حساب الكوميشن
 */
import { Router } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  repairJobServicesTable,
  repairJobServicePartsTable,
  repairServiceTypesTable,
  repairJobsTable,
  repairJobPartsTable,
} from "@workspace/db";
import { wrap } from "../../lib/async-handler";
import { ctx } from "./_shared";

const router = Router();

/* ── Zod schemas ─────────────────────────────────────────────── */
const createServiceSchema = z.object({
  service_type_id:   z.number().int().positive().optional().nullable(),
  service_type_name: z.string().max(120).optional().nullable(),
  technician_id:     z.number().int().positive().optional().nullable(),
  technician_name:   z.string().min(1, "اسم الفني مطلوب").max(200),
  amount:            z.number().min(0).optional().default(0),
  status:            z.enum(["pending", "in_progress", "completed"]).optional().default("pending"),
  notes:             z.string().max(500).optional().nullable(),
});

const updateServiceSchema = z.object({
  service_type_id:   z.number().int().positive().optional().nullable(),
  service_type_name: z.string().max(120).optional().nullable(),
  technician_id:     z.number().int().positive().optional().nullable(),
  technician_name:   z.string().min(1).max(200).optional(),
  amount:            z.number().min(0).optional(),
  status:            z.enum(["pending", "in_progress", "completed"]).optional(),
  notes:             z.string().max(500).optional().nullable(),
});

const linkPartSchema = z.object({
  part_id:            z.number().int().positive(),
  quantity_allocated: z.number().positive().optional().default(1),
});

/* helper — verify job belongs to company */
async function getJob(jobId: number, company_id: number) {
  const [job] = await db
    .select({ id: repairJobsTable.id })
    .from(repairJobsTable)
    .where(and(eq(repairJobsTable.id, jobId), eq(repairJobsTable.company_id, company_id)));
  return job ?? null;
}

/* ── GET /api/repair-jobs/:id/services ───────────────────────── */
router.get("/api/repair-jobs/:id/services", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const jobId = Number(req.params.id);

  const services = await db
    .select()
    .from(repairJobServicesTable)
    .where(and(
      eq(repairJobServicesTable.job_id, jobId),
      eq(repairJobServicesTable.company_id, company_id),
    ));

  const serviceIds = services.map(s => s.id);
  let linkedParts: Array<{
    id: number; service_id: number; part_id: number;
    quantity_allocated: string; product_name: string; unit_price: string;
  }> = [];

  if (serviceIds.length > 0) {
    linkedParts = await db
      .select({
        id:                 repairJobServicePartsTable.id,
        service_id:         repairJobServicePartsTable.service_id,
        part_id:            repairJobServicePartsTable.part_id,
        quantity_allocated: repairJobServicePartsTable.quantity_allocated,
        product_name:       repairJobPartsTable.product_name,
        unit_price:         repairJobPartsTable.unit_price,
      })
      .from(repairJobServicePartsTable)
      .innerJoin(repairJobPartsTable, eq(repairJobPartsTable.id, repairJobServicePartsTable.part_id))
      .where(inArray(repairJobServicePartsTable.service_id, serviceIds));
  }

  const partsByService = linkedParts.reduce<Record<number, typeof linkedParts>>((acc, p) => {
    if (!acc[p.service_id]) acc[p.service_id] = [];
    acc[p.service_id].push(p);
    return acc;
  }, {});

  res.json(services.map(s => ({ ...s, linked_parts: partsByService[s.id] ?? [] })));
}));

/* ── POST /api/repair-jobs/:id/services ──────────────────────── */
router.post("/api/repair-jobs/:id/services", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const jobId = Number(req.params.id);

  const job = await getJob(jobId, company_id);
  if (!job) { res.status(404).json({ error: "البطاقة غير موجودة" }); return; }

  const v = createServiceSchema.safeParse(req.body);
  if (!v.success) { res.status(400).json({ error: v.error.issues[0]?.message }); return; }

  let nameSnapshot = v.data.service_type_name ?? v.data.technician_name;
  let codeSnapshot: string | null = null;

  if (v.data.service_type_id) {
    const [st] = await db
      .select({ name_ar: repairServiceTypesTable.name_ar, id: repairServiceTypesTable.id })
      .from(repairServiceTypesTable)
      .where(and(
        eq(repairServiceTypesTable.id, v.data.service_type_id),
        eq(repairServiceTypesTable.company_id, company_id),
      ));
    if (st) {
      nameSnapshot = st.name_ar;
      codeSnapshot = `RST-${st.id}`;
    }
  }

  const [row] = await db
    .insert(repairJobServicesTable)
    .values({
      job_id:                    jobId,
      company_id,
      service_type_id:           v.data.service_type_id ?? null,
      service_type_name_snapshot: nameSnapshot ?? v.data.technician_name,
      service_type_code_snapshot: codeSnapshot,
      technician_id:             v.data.technician_id ?? null,
      technician_name:           v.data.technician_name,
      amount:                    String(v.data.amount),
      status:                    v.data.status,
      notes:                     v.data.notes ?? null,
    })
    .returning();

  res.status(201).json({ ...row, linked_parts: [] });
}));

/* ── PATCH /api/repair-jobs/:id/services/:serviceId ─────────── */
router.patch("/api/repair-jobs/:id/services/:serviceId", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const jobId     = Number(req.params.id);
  const serviceId = Number(req.params.serviceId);

  const [existing] = await db
    .select({ commission_locked: repairJobServicesTable.commission_locked })
    .from(repairJobServicesTable)
    .where(and(
      eq(repairJobServicesTable.id, serviceId),
      eq(repairJobServicesTable.job_id, jobId),
      eq(repairJobServicesTable.company_id, company_id),
    ));
  if (!existing) { res.status(404).json({ error: "بند الخدمة غير موجود" }); return; }
  if (existing.commission_locked) {
    res.status(409).json({ error: "لا يمكن تعديل بند خدمة مقفول بعد التسليم" }); return;
  }

  const v = updateServiceSchema.safeParse(req.body);
  if (!v.success) { res.status(400).json({ error: v.error.issues[0]?.message }); return; }

  const upd: Record<string, unknown> = { updated_at: new Date() };
  if (v.data.technician_id  !== undefined) upd.technician_id  = v.data.technician_id ?? null;
  if (v.data.technician_name !== undefined) upd.technician_name = v.data.technician_name;
  if (v.data.amount         !== undefined) upd.amount         = String(v.data.amount);
  if (v.data.status         !== undefined) upd.status         = v.data.status;
  if (v.data.notes          !== undefined) upd.notes          = v.data.notes ?? null;

  if (v.data.service_type_id !== undefined) {
    upd.service_type_id = v.data.service_type_id ?? null;
    if (v.data.service_type_id) {
      const [st] = await db
        .select({ name_ar: repairServiceTypesTable.name_ar, id: repairServiceTypesTable.id })
        .from(repairServiceTypesTable)
        .where(and(
          eq(repairServiceTypesTable.id, v.data.service_type_id),
          eq(repairServiceTypesTable.company_id, company_id),
        ));
      if (st) {
        upd.service_type_name_snapshot = st.name_ar;
        upd.service_type_code_snapshot = `RST-${st.id}`;
      }
    } else if (v.data.service_type_name) {
      upd.service_type_name_snapshot = v.data.service_type_name;
      upd.service_type_code_snapshot = null;
    }
  }

  const [row] = await db
    .update(repairJobServicesTable)
    .set(upd)
    .where(and(
      eq(repairJobServicesTable.id, serviceId),
      eq(repairJobServicesTable.job_id, jobId),
      eq(repairJobServicesTable.company_id, company_id),
    ))
    .returning();
  res.json(row);
}));

/* ── DELETE /api/repair-jobs/:id/services/:serviceId ─────────── */
router.delete("/api/repair-jobs/:id/services/:serviceId", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const jobId     = Number(req.params.id);
  const serviceId = Number(req.params.serviceId);

  const [existing] = await db
    .select({ commission_locked: repairJobServicesTable.commission_locked })
    .from(repairJobServicesTable)
    .where(and(
      eq(repairJobServicesTable.id, serviceId),
      eq(repairJobServicesTable.job_id, jobId),
      eq(repairJobServicesTable.company_id, company_id),
    ));
  if (!existing) { res.status(404).json({ error: "بند الخدمة غير موجود" }); return; }
  if (existing.commission_locked) {
    res.status(409).json({ error: "لا يمكن حذف بند خدمة مقفول بعد التسليم" }); return;
  }

  await db.delete(repairJobServicesTable).where(and(
    eq(repairJobServicesTable.id, serviceId),
    eq(repairJobServicesTable.job_id, jobId),
    eq(repairJobServicesTable.company_id, company_id),
  ));
  res.json({ ok: true });
}));

/* ── POST /api/repair-jobs/:id/services/:serviceId/parts ──────── */
router.post("/api/repair-jobs/:id/services/:serviceId/parts", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const jobId     = Number(req.params.id);
  const serviceId = Number(req.params.serviceId);

  const [svc] = await db
    .select({ id: repairJobServicesTable.id, commission_locked: repairJobServicesTable.commission_locked })
    .from(repairJobServicesTable)
    .where(and(
      eq(repairJobServicesTable.id, serviceId),
      eq(repairJobServicesTable.job_id, jobId),
      eq(repairJobServicesTable.company_id, company_id),
    ));
  if (!svc) { res.status(404).json({ error: "بند الخدمة غير موجود" }); return; }
  if (svc.commission_locked) {
    res.status(409).json({ error: "الخدمة مقفولة بعد التسليم" }); return;
  }

  const v = linkPartSchema.safeParse(req.body);
  if (!v.success) { res.status(400).json({ error: v.error.issues[0]?.message }); return; }

  const [part] = await db
    .select({
      id:           repairJobPartsTable.id,
      product_name: repairJobPartsTable.product_name,
      unit_price:   repairJobPartsTable.unit_price,
    })
    .from(repairJobPartsTable)
    .where(and(
      eq(repairJobPartsTable.id, v.data.part_id),
      eq(repairJobPartsTable.job_id, jobId),
      eq(repairJobPartsTable.company_id, company_id),
    ));
  if (!part) { res.status(404).json({ error: "القطعة غير موجودة في هذه البطاقة" }); return; }

  const [row] = await db
    .insert(repairJobServicePartsTable)
    .values({
      service_id:         serviceId,
      part_id:            v.data.part_id,
      quantity_allocated: String(v.data.quantity_allocated),
    })
    .onConflictDoUpdate({
      target: [repairJobServicePartsTable.service_id, repairJobServicePartsTable.part_id],
      set: { quantity_allocated: String(v.data.quantity_allocated) },
    })
    .returning();

  res.status(201).json({ ...row, product_name: part.product_name, unit_price: part.unit_price });
}));

/* ── DELETE /api/repair-jobs/:id/services/:serviceId/parts/:partId */
router.delete("/api/repair-jobs/:id/services/:serviceId/parts/:partId", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const jobId     = Number(req.params.id);
  const serviceId = Number(req.params.serviceId);
  const partId    = Number(req.params.partId);

  const [svc] = await db
    .select({ id: repairJobServicesTable.id })
    .from(repairJobServicesTable)
    .where(and(
      eq(repairJobServicesTable.id, serviceId),
      eq(repairJobServicesTable.job_id, jobId),
      eq(repairJobServicesTable.company_id, company_id),
    ));
  if (!svc) { res.status(404).json({ error: "بند الخدمة غير موجود" }); return; }

  await db.delete(repairJobServicePartsTable).where(and(
    eq(repairJobServicePartsTable.service_id, serviceId),
    eq(repairJobServicePartsTable.part_id, partId),
  ));
  res.json({ ok: true });
}));

export default router;
