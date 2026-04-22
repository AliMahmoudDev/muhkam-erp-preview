/**
 * /api/notifications — In-app notification center for the current user.
 * Each notification belongs to a single user_id (the recipient).
 */
import { Router, type IRouter } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";
import { wrap } from "../lib/async-handler";

const router: IRouter = Router();
const fmt = (v: Date | null | undefined) => (v instanceof Date ? v.toISOString() : (v ?? null));

/* ── List notifications for the current user (newest first, capped at 50) ── */
router.get("/notifications", wrap(async (req, res) => {
  const userId = req.user?.id;
  const companyId = req.user?.company_id;
  if (!userId || !companyId) { res.status(401).json({ error: "غير مصرح" }); return; }
  const onlyUnread = String(req.query["unread"] ?? "") === "true";
  const conditions = [
    eq(notificationsTable.user_id, userId),
    eq(notificationsTable.company_id, companyId),
  ];
  if (onlyUnread) conditions.push(eq(notificationsTable.is_read, false));
  const rows = await db.select().from(notificationsTable)
    .where(and(...conditions))
    .orderBy(desc(notificationsTable.created_at))
    .limit(50);
  res.json(rows.map(r => ({ ...r, created_at: fmt(r.created_at), read_at: fmt(r.read_at) })));
}));

/* ── Unread count (lightweight, for the bell badge) ── */
router.get("/notifications/unread-count", wrap(async (req, res) => {
  const userId = req.user?.id;
  const companyId = req.user?.company_id;
  if (!userId || !companyId) { res.status(401).json({ error: "غير مصرح" }); return; }
  const [row] = await db.select({ count: sql<number>`COUNT(*)::int` }).from(notificationsTable)
    .where(and(
      eq(notificationsTable.user_id, userId),
      eq(notificationsTable.company_id, companyId),
      eq(notificationsTable.is_read, false),
    ));
  res.json({ count: row?.count ?? 0 });
}));

/* ── Mark single notification as read ── */
router.post("/notifications/:id/read", wrap(async (req, res) => {
  const userId = req.user?.id;
  const companyId = req.user?.company_id;
  if (!userId || !companyId) { res.status(401).json({ error: "غير مصرح" }); return; }
  const id = parseInt(String(req.params["id"]), 10);
  if (isNaN(id)) { res.status(400).json({ error: "معرف غير صحيح" }); return; }
  await db.update(notificationsTable)
    .set({ is_read: true, read_at: new Date() })
    .where(and(
      eq(notificationsTable.id, id),
      eq(notificationsTable.user_id, userId),
      eq(notificationsTable.company_id, companyId),
    ));
  res.json({ ok: true });
}));

/* ── Mark all read ── */
router.post("/notifications/mark-all-read", wrap(async (req, res) => {
  const userId = req.user?.id;
  const companyId = req.user?.company_id;
  if (!userId || !companyId) { res.status(401).json({ error: "غير مصرح" }); return; }
  await db.update(notificationsTable)
    .set({ is_read: true, read_at: new Date() })
    .where(and(
      eq(notificationsTable.user_id, userId),
      eq(notificationsTable.company_id, companyId),
      eq(notificationsTable.is_read, false),
    ));
  res.json({ ok: true });
}));

/* ── Delete notification ── */
router.delete("/notifications/:id", wrap(async (req, res) => {
  const userId = req.user?.id;
  const companyId = req.user?.company_id;
  if (!userId || !companyId) { res.status(401).json({ error: "غير مصرح" }); return; }
  const id = parseInt(String(req.params["id"]), 10);
  if (isNaN(id)) { res.status(400).json({ error: "معرف غير صحيح" }); return; }
  await db.delete(notificationsTable)
    .where(and(
      eq(notificationsTable.id, id),
      eq(notificationsTable.user_id, userId),
      eq(notificationsTable.company_id, companyId),
    ));
  res.json({ ok: true });
}));

export { router as notificationsRouter };
