/**
 * Devices module shared helpers — context extractor, device number generator, and Zod schemas.
 *
 * Imported by all sub-modules: crud.ts, sales.ts, returns.ts.
 * Do not import from routes outside the devices/ folder.
 */
import type Express from "express";
import { z } from "zod";
import { db, devicesTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";

// ── Payment type constants ────────────────────────────────────────────────────
export const PAYMENT_TYPES = ["cash", "credit", "partial"] as const;

// ── Request context extractor ─────────────────────────────────────────────────
// Provides typed access to the authenticated user properties used throughout
// the devices module. Kept as a plain function (not middleware) to avoid
// spreading Express dependency into every helper.
export function ctx(req: Express.Request) {
  const u = (req as unknown as {
    user: { company_id: number; id: number; name: string; role?: string; warehouse_id?: number };
  }).user;
  return {
    company_id:  u.company_id,
    user_id:     u.id,
    user_name:   u.name,
    role:        u.role ?? "cashier",
    warehouse_id: u.warehouse_id ?? null,
  };
}

// ── Device number generator ───────────────────────────────────────────────────
// Format: DEV-YYYY-XXXX (e.g. DEV-2025-0042)
export async function nextDeviceNo(company_id: number): Promise<string> {
  const year   = new Date().getFullYear();
  const prefix = `DEV-${year}-`;
  const rows   = await db
    .select({ no: devicesTable.device_no })
    .from(devicesTable)
    .where(and(
      eq(devicesTable.company_id, company_id),
      sql`${devicesTable.device_no} LIKE ${prefix + "%"}`,
    ))
    .orderBy(desc(devicesTable.id))
    .limit(1);
  if (!rows.length) return `${prefix}0001`;
  const last = rows[0].no;
  const seq  = parseInt(last.split("-").pop() ?? "0", 10);
  return `${prefix}${String(seq + 1).padStart(4, "0")}`;
}

// ── Zod validation schemas ────────────────────────────────────────────────────

export const createDeviceSchema = z.object({
  brand:            z.string({ required_error: "الشركة المصنعة مطلوبة" }).min(1).max(100),
  model:            z.string({ required_error: "الموديل مطلوب" }).min(1).max(100),
  color:            z.string().max(50).optional().nullable(),
  storage:          z.string().max(50).optional().nullable(),
  grade:            z.string().max(20).optional().nullable(),
  imei:             z.string().max(50).optional().nullable(),
  serial_no:        z.string().max(100).optional().nullable(),
  battery_health:   z.number().int().min(0).max(100).optional().nullable(),
  condition_notes:  z.string().max(500).optional().nullable(),
  purchase_price:   z.number().min(0).optional().nullable(),
  sale_price:       z.number().min(0).optional().nullable(),
  dual_sim:         z.boolean().optional(),
  with_box:         z.boolean().optional(),
  icloud_locked:    z.boolean().optional(),
  network_locked:   z.boolean().optional(),
  previously_opened: z.boolean().optional(),
  mdm_locked:       z.boolean().optional(),
  supplier_name:    z.string().max(200).optional().nullable(),
  supplier_phone:   z.string().max(20).optional().nullable(),
  branch_id:        z.number().int().positive().optional().nullable(),
});

export const purchaseDeviceSchema = z.object({
  brand:          z.string({ required_error: "الشركة المصنعة مطلوبة" }).min(1).max(100),
  model:          z.string({ required_error: "الموديل مطلوب" }).min(1).max(100),
  purchase_price: z.number({ required_error: "سعر الشراء مطلوب", invalid_type_error: "سعر الشراء يجب أن يكون رقماً" }).positive("سعر الشراء يجب أن يكون أكبر من صفر"),
  payment_type:   z.enum(PAYMENT_TYPES, { errorMap: () => ({ message: "طريقة الدفع غير صحيحة" }) }),
  sale_price:     z.number().min(0).optional(),
  customer_id:    z.number().int().positive().optional().nullable(),
  new_customer_name: z.string().max(200).optional().nullable(),
  safe_id:        z.number().int().positive().optional().nullable(),
  warehouse_id:   z.number().int().positive().optional().nullable(),
  paid_amount:    z.number().min(0).optional(),
  color:          z.string().max(50).optional().nullable(),
  storage:        z.string().max(50).optional().nullable(),
  grade:          z.string().max(20).optional().nullable(),
  imei:           z.string().max(50).optional().nullable(),
  battery_health: z.number().int().min(0).max(100).optional().nullable(),
  supplier_phone: z.string().max(20).optional().nullable(),
  id_card_data:   z.string().max(500).optional().nullable(),
  condition_notes: z.string().max(500).optional().nullable(),
});

export const sellDeviceSchema = z.object({
  sold_price:     z.number({ required_error: "سعر البيع مطلوب" }).positive("سعر البيع يجب أن يكون أكبر من صفر"),
  payment_method: z.string().max(50).optional().default("cash"),
  payment_status: z.string().max(50).optional().default("paid"),
  customer_id:    z.number().int().positive().optional().nullable(),
  customer_name:  z.string().max(200).optional().nullable(),
  warranty_months: z.number().int().min(0).optional().default(0),
});

export const returnDeviceSchema = z.object({
  return_reason: z.string().max(500).optional().nullable(),
});
