import {
  pgTable, serial, text, numeric, integer, timestamp, index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { productsTable } from "./products";
import { companiesTable } from "./companies";
import { branchesTable } from "./branches";

// ─── نقل المخزون بين الفروع — جدول رئيسي ─────────────────────────────────────
// كل سجل = طلب نقل لمنتج واحد من فرع إلى آخر
// سير العمل: pending → approved → shipped → received (أو cancelled في أي مرحلة)

export const stockTransfersTable = pgTable("stock_transfers", {
  id: serial("id").primaryKey(),

  // ── الشركة ──
  company_id: integer("company_id")
    .notNull()
    .references(() => companiesTable.id),

  // ── المنتج ──
  product_id:   integer("product_id").notNull().references(() => productsTable.id),
  product_name: text("product_name").notNull(),
  quantity:     numeric("quantity", { precision: 12, scale: 3 }).notNull(),

  // ── الفروع ──
  from_branch_id: integer("from_branch_id").references(() => branchesTable.id),
  to_branch_id:   integer("to_branch_id").references(() => branchesTable.id),

  // ── سير العمل ──
  status: text("status").notNull().default("pending"),
  // القيم المسموحة: pending | approved | shipped | received | cancelled

  // ── رمز التحقق (6 أرقام عشوائية) ──
  verification_code: text("verification_code"),

  // ── المستخدمون المسؤولون ──
  created_by:  integer("created_by"),
  approved_by: integer("approved_by"),
  shipped_by:  integer("shipped_by"),
  received_by: integer("received_by"),

  // ── التواريخ ──
  created_at:  timestamp("created_at",  { withTimezone: true }).notNull().defaultNow(),
  approved_at: timestamp("approved_at", { withTimezone: true }),
  shipped_at:  timestamp("shipped_at",  { withTimezone: true }),
  received_at: timestamp("received_at", { withTimezone: true }),

  // ── ملاحظات ──
  notes: text("notes"),
}, (t) => [
  index("st_company_status_idx").on(t.company_id, t.status),
  index("st_company_from_branch_idx").on(t.company_id, t.from_branch_id),
  index("st_company_to_branch_idx").on(t.company_id, t.to_branch_id),
  index("st_created_at_idx").on(t.created_at),
]);

// ─── بنود التحويل القديمة (مستخدمة من نظام نقل المخازن) ────────────────────
// محتفظ بها للتوافق مع الإصدار السابق — لا تُستخدم في نظام الفروع الجديد
export const stockTransferItemsTable = pgTable("stock_transfer_items", {
  id:           serial("id").primaryKey(),
  transfer_id:  integer("transfer_id").notNull(),
  product_id:   integer("product_id").notNull().references(() => productsTable.id),
  product_name: text("product_name").notNull(),
  quantity:     numeric("quantity", { precision: 12, scale: 3 }).notNull(),
  unit_cost:    numeric("unit_cost", { precision: 12, scale: 4 }).notNull().default("0"),
  created_at:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── أنواع TypeScript ──────────────────────────────────────────────────────────
export type StockTransfer     = typeof stockTransfersTable.$inferSelect;
export type NewStockTransfer  = typeof stockTransfersTable.$inferInsert;
export type StockTransferItem = typeof stockTransferItemsTable.$inferSelect;

// ─── حالات سير العمل ──────────────────────────────────────────────────────────
export const STOCK_TRANSFER_STATUSES = [
  "pending",
  "approved",
  "shipped",
  "received",
  "cancelled",
] as const;
export type StockTransferStatus = typeof STOCK_TRANSFER_STATUSES[number];

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

export const InsertStockTransferSchema = createInsertSchema(stockTransfersTable, {
  company_id:    z.number().int().positive(),
  product_id:    z.number().int().positive(),
  product_name:  z.string().min(1),
  quantity:      z.union([z.string(), z.number()]).refine(
    (v) => Number(v) > 0,
    { message: "الكمية يجب أن تكون أكبر من صفر" },
  ),
  from_branch_id: z.number().int().positive().optional(),
  to_branch_id:   z.number().int().positive().optional(),
  status:         z.enum(STOCK_TRANSFER_STATUSES).optional(),
  verification_code: z.string().length(6).optional(),
  created_by:    z.number().int().positive().optional(),
  approved_by:   z.number().int().positive().optional(),
  shipped_by:    z.number().int().positive().optional(),
  received_by:   z.number().int().positive().optional(),
  notes:         z.string().optional(),
}).omit({
  id:          true,
  created_at:  true,
  approved_at: true,
  shipped_at:  true,
  received_at: true,
});

export type InsertStockTransfer = z.infer<typeof InsertStockTransferSchema>;

// Schema لإنشاء طلب نقل جديد (من واجهة المستخدم)
export const CreateStockTransferSchema = z.object({
  company_id:     z.number().int().positive(),
  product_id:     z.number().int().positive(),
  product_name:   z.string().min(1),
  quantity:       z.number().positive(),
  from_branch_id: z.number().int().positive(),
  to_branch_id:   z.number().int().positive(),
  notes:          z.string().optional(),
}).refine(
  (d) => d.from_branch_id !== d.to_branch_id,
  { message: "فرع الإرسال وفرع الاستلام يجب أن يكونا مختلفَين" },
);

// Schema لتحديث الحالة
export const UpdateStockTransferStatusSchema = z.object({
  status:            z.enum(STOCK_TRANSFER_STATUSES),
  verification_code: z.string().length(6).optional(),
  notes:             z.string().optional(),
});

export type CreateStockTransfer       = z.infer<typeof CreateStockTransferSchema>;
export type UpdateStockTransferStatus = z.infer<typeof UpdateStockTransferStatusSchema>;

// Schema لاستجابة API
export const StockTransferResponseSchema = z.object({
  id:               z.number(),
  company_id:       z.number(),
  product_id:       z.number(),
  product_name:     z.string(),
  quantity:         z.number(),
  from_branch_id:   z.number().nullable(),
  to_branch_id:     z.number().nullable(),
  status:           z.string(),
  verification_code: z.string().nullable(),
  created_by:       z.number().nullable(),
  approved_by:      z.number().nullable(),
  shipped_by:       z.number().nullable(),
  received_by:      z.number().nullable(),
  notes:            z.string().nullable(),
  created_at:       z.string(),
  approved_at:      z.string().nullable(),
  shipped_at:       z.string().nullable(),
  received_at:      z.string().nullable(),
});

export type StockTransferResponse = z.infer<typeof StockTransferResponseSchema>;
