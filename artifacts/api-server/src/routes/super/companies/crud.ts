/**
 * /api/super/companies — CRUD routes (list, get, create, update, delete).
 */
import { Router } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, companiesTable, erpUsersTable } from "@workspace/db";
import type { CompanyFeatures } from "@workspace/db";
import { authenticate, requireRole } from "../../../middleware/auth";
import { invalidateTenantCache } from "../../../middleware/tenant-guard";
import { invalidateFeatureCache } from "../../../middleware/feature-guard";
import { wrap } from "../../../lib/async-handler";
import { hashPin } from "../../../lib/hash";
import { createCompanySchema, validate } from "../../../lib/schemas";
import { writeAuditLog } from "../../../lib/audit-log";
import { logger } from "../../../lib/logger";
import { cascadeDeleteCompany, daysRemaining } from "./helpers";

const router = Router();
const superOnly = [authenticate, requireRole("super_admin")];

/* ── GET /super/companies — list all companies with stats ── */
router.get("/super/companies", ...superOnly, wrap(async (req, res) => {
  void writeAuditLog({
    action: "SUPER_ADMIN_LIST_VIEW", record_type: "company", record_id: 0,
    user: req.user, company_id: null,
    note: "عرض قائمة كل الشركات",
  });
  const companies = await db
    .select()
    .from(companiesTable)
    .orderBy(desc(companiesTable.created_at));

  const userCounts = await db
    .select({
      company_id: erpUsersTable.company_id,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(erpUsersTable)
    .groupBy(erpUsersTable.company_id);

  const countMap = new Map<number, number>();
  for (const row of userCounts) {
    if (row.company_id != null) countMap.set(row.company_id, row.count);
  }

  const result = companies.map((co) => {
    const days = daysRemaining(co.end_date);
    const status =
      !co.is_active ? "suspended" :
      days < 0     ? "expired" :
      co.plan_type === "trial" ? "trial" : "active";

    return {
      ...co,
      daysRemaining: days,
      status,
      userCount: countMap.get(co.id) ?? 0,
    };
  });

  res.json(result);
}));

/* ── GET /super/companies/:id — single company detail ── */
router.get("/super/companies/:id", ...superOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  const [co] = await db.select().from(companiesTable).where(eq(companiesTable.id, id));
  if (!co) { res.status(404).json({ error: "الشركة غير موجودة" }); return; }

  void writeAuditLog({
    action: "SUPER_ADMIN_ACCESS", record_type: "company", record_id: id,
    new_value: { viewed_company_name: co.name },
    user: req.user, company_id: null,
    note: `عرض تفاصيل شركة: ${co.name}`,
  });

  const users = await db
    .select({
      id: erpUsersTable.id,
      name: erpUsersTable.name,
      username: erpUsersTable.username,
      email: erpUsersTable.email,
      role: erpUsersTable.role,
      active: erpUsersTable.active,
    })
    .from(erpUsersTable)
    .where(eq(erpUsersTable.company_id, id));

  res.json({ ...co, daysRemaining: daysRemaining(co.end_date), users });
}));

/* ── PUT /super/companies/:id — update plan / expiry / active ── */
router.put("/super/companies/:id", ...superOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  const { name, plan_type, edition, end_date, is_active, features } = req.body as {
    name?: string; plan_type?: string; edition?: string; end_date?: string; is_active?: boolean;
    features?: Record<string, boolean>;
  };

  const [before] = await db.select().from(companiesTable).where(eq(companiesTable.id, id));
  if (!before) { res.status(404).json({ error: "الشركة غير موجودة" }); return; }

  const updates: Partial<typeof companiesTable.$inferInsert> = {};
  if (name      !== undefined) updates.name      = name.trim();
  if (plan_type !== undefined) updates.plan_type = plan_type;
  if (edition   !== undefined && ["advanced","ultimate"].includes(edition)) updates.edition = edition;
  if (end_date  !== undefined) updates.end_date  = end_date;
  if (is_active !== undefined) updates.is_active = is_active;
  if (features  !== undefined) updates.features  = features as CompanyFeatures;

  const [updated] = await db
    .update(companiesTable).set(updates)
    .where(eq(companiesTable.id, id)).returning();

  if (!updated) {
    res.status(404).json({ error: "الشركة حُذفت أثناء التحديث" });
    return;
  }

  invalidateTenantCache(id);
  invalidateFeatureCache(id);

  await writeAuditLog({
    action: "update", record_type: "company", record_id: id,
    old_value: before, new_value: updated,
    user: req.user, company_id: req.user?.company_id ?? null,
    note: "تعديل بيانات الشركة من لوحة المدير العام",
  });

  res.json({ ...updated, daysRemaining: daysRemaining(updated.end_date) });
}));

/* ── POST /super/companies — create company + admin user manually (super only) ── */
router.post("/super/companies", ...superOnly, wrap(async (req, res) => {
  const v = validate(createCompanySchema, req.body);
  if (!v.success) { res.status(400).json({ error: "بيانات غير صحيحة", details: v.errors }); return; }

  const { name, plan_type, edition = "ultimate", duration_days, admin_email, admin_name, admin_username } = v.data;
  const today = new Date();
  const end   = new Date(today);
  end.setDate(end.getDate() + (duration_days ?? 30));

  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!";
  let tempPassword = "";
  for (let i = 0; i < 12; i++) tempPassword += chars[Math.floor(Math.random() * chars.length)];

  const result = await db.transaction(async (tx) => {
    const [co] = await tx.insert(companiesTable).values({
      name:        name.trim(),
      plan_type,
      edition,
      start_date:  today.toISOString().slice(0, 10),
      end_date:    end.toISOString().slice(0, 10),
      is_active:   true,
      admin_email: admin_email ?? null,
    }).returning();

    const resolvedAdminName = admin_name?.trim() || `مدير ${name.trim()}`;

    let resolvedUsername = admin_username?.trim().toLowerCase();
    if (!resolvedUsername) {
      const slug = name
        .trim()
        .toLowerCase()
        .replace(/[\u0600-\u06ff\s]+/g, "_")
        .replace(/[^a-z0-9_]/g, "")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "")
        .slice(0, 20) || "admin";
      resolvedUsername = `${slug}_${co.id}`;
    }

    const [taken] = await tx
      .select({ id: erpUsersTable.id })
      .from(erpUsersTable)
      .where(sql`LOWER(${erpUsersTable.username}) = ${resolvedUsername}`);
    if (taken) resolvedUsername = `${resolvedUsername}_${co.id}`;

    const hashedPw = await hashPin(tempPassword);
    const [user] = await tx.insert(erpUsersTable).values({
      name:        resolvedAdminName,
      username:    resolvedUsername,
      pin:         hashedPw,
      role:        "admin",
      active:      true,
      company_id:  co.id,
      permissions: "{}",
      email:       admin_email ?? null,
    }).returning({
      id: erpUsersTable.id,
      username: erpUsersTable.username,
      name: erpUsersTable.name,
    });

    return { company: co, admin: user };
  });

  await writeAuditLog({
    action: "create", record_type: "company", record_id: result.company.id,
    old_value: null, new_value: { name, plan_type, admin: result.admin.username },
    user: req.user, company_id: null,
    note: `إنشاء شركة جديدة مع مستخدم مدير: ${result.admin.username}`,
  });

  res.status(201).json({
    company: result.company,
    admin: {
      username:      result.admin.username,
      name:          result.admin.name,
      temp_password: tempPassword,
    },
    message: "تم إنشاء الشركة والمستخدم بنجاح",
  });
}));

/* ── DELETE /super/companies/:id — delete a company ── */
router.delete("/super/companies/:id", ...superOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);

  const [co] = await db.select().from(companiesTable).where(eq(companiesTable.id, id));
  if (!co) { res.status(404).json({ error: "الشركة غير موجودة" }); return; }

  const usersInCompany = await db
    .select({ id: erpUsersTable.id })
    .from(erpUsersTable)
    .where(eq(erpUsersTable.company_id, id));

  const { confirm_code, expected_code, force } = req.body as {
    confirm_code?: string; expected_code?: string; force?: boolean;
  };

  if (usersInCompany.length > 0) {
    const isTrial = co.plan_type === "trial";
    if (!force) {
      res.status(400).json({
        error: "يوجد مستخدمون مرتبطون بهذه الشركة",
        has_users: true,
        user_count: usersInCompany.length,
        is_trial: isTrial,
      });
      return;
    }
    if (!confirm_code || !expected_code || confirm_code.trim() !== expected_code.trim()) {
      res.status(400).json({ error: "كود التأكيد غير صحيح" });
      return;
    }
  }

  try {
    await cascadeDeleteCompany(id);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const isPgFk = typeof (err as Record<string, unknown>)?.code === "string" &&
      ((err as Record<string, unknown>).code as string).startsWith("23");
    logger.error({ err, companyId: id }, "[super/companies] cascade delete failed");
    if (isPgFk) {
      res.status(409).json({
        error: "فشل حذف الشركة — يوجد بيانات مرتبطة لم يتم حذفها بالكامل. يرجى التواصل مع الدعم الفني.",
        details: process.env.NODE_ENV !== "production" ? msg : undefined,
      });
      return;
    }
    throw err;
  }

  await writeAuditLog({
    action: "COMPANY_DELETED", record_type: "company", record_id: id,
    old_value: co, new_value: { deleted_user_count: usersInCompany.length, force: !!force },
    user: req.user, company_id: req.user?.company_id ?? null,
    note: "حذف شركة من لوحة المدير العام",
  });

  res.json({ message: "تم حذف الشركة وجميع بياناتها بنجاح" });
}));

export default router;
