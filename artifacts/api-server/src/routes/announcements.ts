/**
 * /api/announcements — tenant-facing announcements endpoint.
 * Returns active announcements targeting this company (or "all").
 * Super admins see all active announcements (for testing).
 */
import { Router, type IRouter } from "express";
import { db, announcementsTable } from "@workspace/db";
import { sql, and, or, eq, isNull, gt } from "drizzle-orm";
import { wrap } from "../lib/async-handler";

const router: IRouter = Router();

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

export default router;
