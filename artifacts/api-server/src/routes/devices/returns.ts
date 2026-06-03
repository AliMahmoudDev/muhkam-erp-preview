/**
 * Device state transition routes:
 *   POST /devices/:id/sell        — mark as sold, create warranty if applicable
 *   POST /devices/:id/return      — customer return (sold → available)
 *   POST /devices/:id/maintenance — send to maintenance (available → maintenance)
 *   POST /devices/:id/available   — return from maintenance (maintenance → available)
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { devicesTable, warrantyTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { wrap } from "../../lib/async-handler";
import { hasPermission } from "../../lib/permissions";
import { firstZodError } from "../../lib/schemas";
import { ctx, sellDeviceSchema, returnDeviceSchema } from "./_helpers";

const router = Router();

/**
 * @description Sell a device — marks it as sold, records customer info and
 *              payment details. Auto-creates a warranty record if warranty_months > 0.
 * @route  POST /devices/:id/sell
 * @access can_manage_devices
 */
router.post("/devices/:id/sell", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_devices")) {
    return res.status(403).json({ error: "غير مصرح ببيع الأجهزة" });
  }
  const { company_id, user_id, user_name } = ctx(req);
  const id = Number(req.params.id);
  const vs = sellDeviceSchema.safeParse(req.body);
  if (!vs.success) return res.status(400).json({ error: vs.error.errors[0]?.message ?? "بيانات غير صالحة" });
  const { customer_id, customer_name, sold_price, payment_method, payment_status, warranty_months } = vs.data;

  const [existing] = await db.select().from(devicesTable).where(and(eq(devicesTable.id, id), eq(devicesTable.company_id, company_id)));
  if (!existing) return res.status(404).json({ error: "not found" });
  if (existing.status !== "available") return res.status(400).json({ error: "الجهاز غير متاح للبيع" });

  const soldAt  = new Date();
  const wMonths = warranty_months ? parseInt(String(warranty_months)) : 0;

  const row = await db.transaction(async (tx) => {
    const [updated] = await tx.update(devicesTable).set({
      status:                  "sold",
      sold_to_customer_id:     customer_id ?? null,
      sold_to_customer_name:   customer_name ?? null,
      sold_price:              String(sold_price ?? existing.sale_price ?? 0),
      sold_at:                 soldAt,
      sold_by_user_id:         user_id,
      sold_by_user_name:       user_name,
      payment_method:          payment_method ?? "cash",
      payment_status:          payment_status ?? "paid",
      warranty_months:         warranty_months ?? null,
      updated_at:              soldAt,
    }).where(and(eq(devicesTable.id, id), eq(devicesTable.company_id, company_id))).returning();

    // Auto-create warranty record inside same transaction
    if (wMonths > 0) {
      const startDate = soldAt;
      const endDate   = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + wMonths);
      await tx.insert(warrantyTable).values({
        company_id,
        product_name:    `${existing.brand} ${existing.model}`,
        customer_id:     customer_id ? Number(customer_id) : null,
        customer_name:   customer_name ?? null,
        customer_phone:  null,
        serial_number:   existing.imei ?? existing.serial_no ?? null,
        device_model:    `${existing.brand} ${existing.model}`,
        warranty_months: wMonths,
        warranty_start:  startDate.toISOString().split("T")[0],
        warranty_end:    endDate.toISOString().split("T")[0],
        status:          "active",
        notes:           `بيع جهاز مستخدم — ${existing.device_no}`,
        sale_id:         null,
      });
    }

    return updated;
  });

  return res.json(row);
}));

/**
 * @description Customer return — transitions device from "sold" back to "available".
 *              Clears all sale-related fields and appends return reason to notes.
 * @route  POST /devices/:id/return
 * @access can_manage_devices
 */
router.post("/devices/:id/return", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_devices")) {
    return res.status(403).json({ error: "غير مصرح بتسجيل إرجاع الجهاز" });
  }
  const { company_id } = ctx(req);
  const id = Number(req.params.id);
  const vrd = returnDeviceSchema.safeParse(req.body);
  if (!vrd.success) return res.status(400).json({ error: firstZodError(vrd.error) });
  const { return_reason } = vrd.data;

  const [existing] = await db.select().from(devicesTable).where(and(eq(devicesTable.id, id), eq(devicesTable.company_id, company_id)));
  if (!existing) return res.status(404).json({ error: "not found" });
  if (existing.status !== "sold") return res.status(400).json({ error: "الجهاز ليس في حالة مباع" });

  const note = return_reason
    ? `[إرجاع من العميل: ${return_reason}]${existing.condition_notes ? " — " + existing.condition_notes : ""}`
    : existing.condition_notes ?? null;

  const [row] = await db.update(devicesTable).set({
    status:                "available",
    sold_to_customer_id:   null,
    sold_to_customer_name: null,
    sold_price:            null,
    sold_at:               null,
    sold_by_user_id:       null,
    sold_by_user_name:     null,
    payment_method:        null,
    payment_status:        null,
    warranty_months:       null,
    condition_notes:       note,
    updated_at:            new Date(),
  }).where(and(eq(devicesTable.id, id), eq(devicesTable.company_id, company_id))).returning();
  return res.json(row);
}));

/**
 * @description Send device to maintenance (available → maintenance).
 * @route  POST /devices/:id/maintenance
 * @access can_manage_devices
 */
router.post("/devices/:id/maintenance", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_devices")) {
    return res.status(403).json({ error: "غير مصرح بتعديل حالة الجهاز" });
  }
  const { company_id } = ctx(req);
  const id = Number(req.params.id);
  const [row] = await db.update(devicesTable).set({ status: "maintenance", updated_at: new Date() })
    .where(and(eq(devicesTable.id, id), eq(devicesTable.company_id, company_id))).returning();
  if (!row) return res.status(404).json({ error: "not found" });
  return res.json(row);
}));

/**
 * @description Return device from maintenance back to available.
 * @route  POST /devices/:id/available
 * @access can_manage_devices
 */
router.post("/devices/:id/available", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_devices")) {
    return res.status(403).json({ error: "غير مصرح بتعديل حالة الجهاز" });
  }
  const { company_id } = ctx(req);
  const id = Number(req.params.id);
  const [row] = await db.update(devicesTable).set({ status: "available", updated_at: new Date() })
    .where(and(eq(devicesTable.id, id), eq(devicesTable.company_id, company_id))).returning();
  if (!row) return res.status(404).json({ error: "not found" });
  return res.json(row);
}));

export default router;
