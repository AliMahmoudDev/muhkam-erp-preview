import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, warrantyTable } from "@workspace/db";
import { wrap, httpError } from "../lib/async-handler";
import { writeAuditLog } from "../lib/audit-log";

const router = Router();

/* ── إحصائيات الضمان (قبل /:id لتجنب التعارض) ───────────────────── */
router.get("/warranty/stats", wrap(async (req, res) => {
  const companyId = req.user?.company_id;
  if (!companyId) throw httpError(401, "غير مصرح");

  const today = new Date().toISOString().split("T")[0];
  const soon = new Date();
  soon.setDate(soon.getDate() + 30);
  const soonStr = soon.toISOString().split("T")[0];

  const rows = await db.select().from(warrantyTable)
    .where(eq(warrantyTable.company_id, companyId));

  const total        = rows.length;
  const active       = rows.filter(r => r.status === "active" && r.warranty_end >= today).length;
  const expired      = rows.filter(r => r.status !== "active" || r.warranty_end < today).length;
  const expiringSoon = rows.filter(r =>
    r.status === "active" && r.warranty_end >= today && r.warranty_end <= soonStr
  ).length;

  res.json({ total, active, expired, expiring_soon: expiringSoon });
}));

/* ── جلب كل سجلات الضمان ─────────────────────────────────────────── */
router.get("/warranty", wrap(async (req, res) => {
  const companyId = req.user?.company_id;
  if (!companyId) throw httpError(401, "غير مصرح");

  const { search } = req.query as Record<string, string | undefined>;

  const rows = await db.select().from(warrantyTable)
    .where(eq(warrantyTable.company_id, companyId))
    .orderBy(desc(warrantyTable.warranty_end));

  let filtered = rows;
  if (search) filtered = filtered.filter(r =>
    r.product_name.includes(search) ||
    (r.customer_name ?? "").includes(search) ||
    (r.serial_number ?? "").includes(search) ||
    (r.device_model ?? "").includes(search)
  );

  const today = new Date().toISOString().split("T")[0];
  const enriched = filtered.map(r => ({
    ...r,
    days_remaining: Math.ceil(
      (new Date(r.warranty_end).getTime() - new Date(today).getTime()) / 86400000
    ),
  }));

  res.json(enriched);
}));

/* ── إنشاء سجل ضمان جديد ─────────────────────────────────────────── */
router.post("/warranty", wrap(async (req, res) => {
  const companyId = req.user?.company_id;
  if (!companyId) throw httpError(401, "غير مصرح");

  const {
    sale_id, product_id, product_name, customer_id, customer_name, customer_phone,
    serial_number, device_model, warranty_months, warranty_start, notes,
  } = req.body;

  if (!product_name) throw httpError(400, "اسم المنتج/الخدمة مطلوب");
  if (!warranty_start) throw httpError(400, "تاريخ بدء الضمان مطلوب");

  const months = parseInt(warranty_months ?? "3") || 3;
  const startDate = new Date(warranty_start);
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + months);

  const [record] = await db.insert(warrantyTable).values({
    company_id:      companyId,
    sale_id:         sale_id ? parseInt(sale_id) : null,
    product_id:      product_id ? parseInt(product_id) : null,
    product_name:    String(product_name),
    customer_id:     customer_id ? parseInt(customer_id) : null,
    customer_name:   customer_name ?? null,
    customer_phone:  customer_phone ?? null,
    serial_number:   serial_number ?? null,
    device_model:    device_model ?? null,
    warranty_months: months,
    warranty_start:  startDate.toISOString().split("T")[0],
    warranty_end:    endDate.toISOString().split("T")[0],
    status:          "active",
    notes:           notes ?? null,
  }).returning();

  void writeAuditLog({
    action: "create",
    record_type: "warranty",
    record_id: record.id,
    new_value: record,
    user: req.user,
    company_id: companyId,
  });

  res.status(201).json(record);
}));

/* ── تحديث حالة الضمان ───────────────────────────────────────────── */
router.patch("/warranty/:id", wrap(async (req, res) => {
  const companyId = req.user?.company_id;
  if (!companyId) throw httpError(401, "غير مصرح");

  const id = parseInt(req.params.id as string);
  if (isNaN(id)) throw httpError(400, "معرّف غير صالح");

  const [existing] = await db.select().from(warrantyTable)
    .where(and(eq(warrantyTable.id, id), eq(warrantyTable.company_id, companyId)));
  if (!existing) throw httpError(404, "غير موجود");

  const { status, notes, serial_number, device_model } = req.body;
  const updates: Partial<typeof warrantyTable.$inferInsert> = {};
  if (status) updates.status = status;
  if (notes !== undefined) updates.notes = notes;
  if (serial_number !== undefined) updates.serial_number = serial_number;
  if (device_model !== undefined) updates.device_model = device_model;

  const [updated] = await db.update(warrantyTable).set(updates)
    .where(and(eq(warrantyTable.id, id), eq(warrantyTable.company_id, companyId)))
    .returning();

  res.json(updated);
}));

/* ── حذف سجل ضمان ────────────────────────────────────────────────── */
router.delete("/warranty/:id", wrap(async (req, res) => {
  const companyId = req.user?.company_id;
  if (!companyId) throw httpError(401, "غير مصرح");

  const id = parseInt(req.params.id as string);
  if (isNaN(id)) throw httpError(400, "معرّف غير صالح");

  await db.delete(warrantyTable)
    .where(and(eq(warrantyTable.id, id), eq(warrantyTable.company_id, companyId)));

  res.json({ success: true });
}));

export default router;
