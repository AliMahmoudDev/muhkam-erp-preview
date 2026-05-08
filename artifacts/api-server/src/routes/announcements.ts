/**
 * /api/announcements — tenant-facing announcements endpoint.
 * Returns active announcements targeting this company (or "all").
 * Super admins see all active announcements (for testing).
 */
import { Router, type IRouter } from "express";
import { db, announcementsTable } from "@workspace/db";
import { sql, and, or, eq, isNull, gt } from "drizzle-orm";
import { wrap, httpError } from "../lib/async-handler";
import { z } from "zod/v4";

const router: IRouter = Router();

const AnnouncementBody = z.object({
  title:      z.string().min(1, "عنوان الإعلان مطلوب"),
  body:       z.string().min(1, "نص الإعلان مطلوب"),
  type:       z.enum(["info", "warning", "success", "danger"]).optional().default("info"),
  target:     z.string().optional().default("all"),
  company_id: z.number().int().positive().nullish(),
  is_active:  z.boolean().optional().default(true),
  expires_at: z.string().datetime({ offset: true }).nullish(),
});

const UpdateAnnouncementBody = z.object({
  title:      z.string().min(1, "عنوان الإعلان مطلوب").optional(),
  body:       z.string().min(1, "نص الإعلان مطلوب").optional(),
  type:       z.enum(["info", "warning", "success", "danger"]).optional(),
  target:     z.string().optional(),
  company_id: z.number().int().positive().nullish(),
  is_active:  z.boolean().optional(),
  expires_at: z.string().datetime({ offset: true }).nullish(),
});

/* GET /api/announcements — fetch active announcements for current company */
router.get("/announcements", wrap(async (req, res) => {
  const user = req.user as { company_id?: number | null; role?: string } | undefined;
  const companyId = user?.company_id ?? null;
  const now = new Date();

  const rows = await db
    .select()
    .from(announcementsTable)
    .where(
      and(
        /* Only active announcements */
        eq(announcementsTable.is_active, true),
        /* Not expired */
        or(
          isNull(announcementsTable.expires_at),
          gt(announcementsTable.expires_at, now)
        ),
        /* Target: all companies OR this specific company */
        or(
          eq(announcementsTable.target, "all"),
          companyId
            ? eq(announcementsTable.company_id, companyId)
            : sql`FALSE`
        )
      )
    )
    .orderBy(sql`${announcementsTable.created_at} DESC`);

  res.json({ announcements: rows, total: rows.length });
}));

/* POST /api/announcements — إنشاء إعلان جديد (للمسؤول العام فقط) */
router.post("/announcements", wrap(async (req, res) => {
  const user = req.user as { role?: string } | undefined;
  if (user?.role !== "super_admin") throw httpError(403, "غير مصرح — للمسؤول العام فقط");

  const parsed = AnnouncementBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات الإعلان غير صحيحة", details: parsed.error.issues.map(i => i.message) });
    return;
  }

  const { title, body, type, target, company_id, is_active, expires_at } = parsed.data;

  const [row] = await db.insert(announcementsTable).values({
    title,
    body,
    type,
    target,
    company_id: company_id ?? null,
    is_active,
    expires_at: expires_at ? new Date(expires_at) : null,
  }).returning();

  res.status(201).json(row);
}));

/* PUT /api/announcements/:id — تعديل إعلان قائم (للمسؤول العام فقط) */
router.put("/announcements/:id", wrap(async (req, res) => {
  const user = req.user as { role?: string } | undefined;
  if (user?.role !== "super_admin") throw httpError(403, "غير مصرح — للمسؤول العام فقط");

  const id = parseInt(String(req.params["id"]), 10);
  if (isNaN(id) || id <= 0) { res.status(400).json({ error: "معرف الإعلان غير صحيح" }); return; }

  const parsed = UpdateAnnouncementBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات الإعلان غير صحيحة", details: parsed.error.issues.map(i => i.message) });
    return;
  }

  const [existing] = await db.select({ id: announcementsTable.id }).from(announcementsTable)
    .where(eq(announcementsTable.id, id));
  if (!existing) throw httpError(404, "الإعلان غير موجود");

  const { title, body, type, target, company_id, is_active, expires_at } = parsed.data;
  const updateData: Partial<typeof announcementsTable.$inferInsert> = {};
  if (title      !== undefined) updateData.title      = title;
  if (body       !== undefined) updateData.body       = body;
  if (type       !== undefined) updateData.type       = type;
  if (target     !== undefined) updateData.target     = target;
  if (is_active  !== undefined) updateData.is_active  = is_active;
  if (company_id !== undefined) updateData.company_id = company_id ?? null;
  if (expires_at !== undefined) updateData.expires_at = expires_at ? new Date(expires_at) : null;

  const [updated] = await db.update(announcementsTable)
    .set(updateData)
    .where(eq(announcementsTable.id, id))
    .returning();

  res.json(updated);
}));

export default router;
