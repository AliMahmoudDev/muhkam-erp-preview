/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  Repair Dashboard Cards — كروت لوحة الصيانة القابلة للتخصيص             ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * إعدادات قابلة للتخصيص لكل شركة، يديرها المسؤولون فقط.
 * كل كارت يضمّ حالة واحدة أو أكثر تحت اسم مخصّص.
 *
 *   GET    /api/repair-dashboard-cards          — قائمة الكروت (يُهيّئ الافتراضي تلقائياً)
 *   POST   /api/repair-dashboard-cards          — إضافة (admin)
 *   PATCH  /api/repair-dashboard-cards/:id      — تعديل (admin)
 *   DELETE /api/repair-dashboard-cards/:id      — حذف   (admin)
 *   POST   /api/repair-dashboard-cards/reorder  — إعادة ترتيب (admin)
 */

import { Router, type IRouter } from "express";
import { eq, and, asc, inArray, desc, sql } from "drizzle-orm";
import {
  db,
  repairDashboardCardsTable,
  repairJobsTable,
  repairStatusHistoryTable,
} from "@workspace/db";
import { wrap } from "../lib/async-handler";
import { requireRole } from "../middleware/auth";

const router: IRouter = Router();

const ctx = (req: unknown) => {
  const u = (req as { user: { company_id: number; id: number; role: string } }).user;
  return { company_id: u.company_id, user_id: u.id, role: u.role };
};

/* ── Defaults seeded on first GET when empty ─────────────────────── */
const DEFAULT_CARDS: Array<{
  name: string; statuses: string[]; color: string; icon: string;
}> = [
  {
    name: "انتظار",
    statuses: ["pending", "received", "waiting_customer_approval", "waiting_parts"],
    color: "#f59e0b",
    icon: "Clock",
  },
  {
    name: "جارية",
    statuses: ["in_progress", "in_repair", "initial_inspection", "diagnosis", "approved", "diagnosing"],
    color: "#06b6d4",
    icon: "Wrench",
  },
  {
    name: "منتهية",
    statuses: ["done", "repaired", "final_quality_check", "ready_for_delivery", "qa", "delivered"],
    color: "#10b981",
    icon: "CheckCheck",
  },
];

function parseStatuses(raw: string | string[] | unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
    } catch { return []; }
  }
  return [];
}

async function ensureDefaults(company_id: number) {
  const existing = await db.select({ id: repairDashboardCardsTable.id })
    .from(repairDashboardCardsTable)
    .where(eq(repairDashboardCardsTable.company_id, company_id))
    .limit(1);
  if (existing.length > 0) return;
  await db.insert(repairDashboardCardsTable).values(
    DEFAULT_CARDS.map((c, i) => ({
      company_id,
      name: c.name,
      statuses: JSON.stringify(c.statuses),
      color: c.color,
      icon: c.icon,
      sort_order: i,
      is_system: true,
    })),
  );
}

/* ── List ──────────────────────────────────────────────────────────── */
router.get("/repair-dashboard-cards", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  await ensureDefaults(company_id);

  const rows = await db.select().from(repairDashboardCardsTable)
    .where(eq(repairDashboardCardsTable.company_id, company_id))
    .orderBy(asc(repairDashboardCardsTable.sort_order), asc(repairDashboardCardsTable.id));

  return res.json(rows.map(r => ({
    id: r.id,
    name: r.name,
    statuses: parseStatuses(r.statuses),
    color: r.color,
    icon: r.icon,
    sort_order: r.sort_order,
    alert_threshold: r.alert_threshold,
    is_system: r.is_system,
  })));
}));

/* ── Dashboard data (counts + breakdown + last update per card) ──── */
/* Path is intentionally NOT under /repair-jobs/* to avoid colliding
   with the repairs router's GET /repair-jobs/:id (where ":id" would
   capture "dashboard" and try to parse it as an integer). */
router.get("/repair-dashboard", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  await ensureDefaults(company_id);

  const cards = await db.select().from(repairDashboardCardsTable)
    .where(eq(repairDashboardCardsTable.company_id, company_id))
    .orderBy(asc(repairDashboardCardsTable.sort_order), asc(repairDashboardCardsTable.id));

  /* Counts grouped by status, single query */
  const statusCounts = await db.select({
    status: repairJobsTable.status,
    count: sql<number>`count(*)`,
  })
    .from(repairJobsTable)
    .where(eq(repairJobsTable.company_id, company_id))
    .groupBy(repairJobsTable.status);

  const countMap = new Map<string, number>();
  for (const r of statusCounts) countMap.set(r.status, Number(r.count));
  const totalAll = Array.from(countMap.values()).reduce((a, b) => a + b, 0);

  /* Build per-card payload + last update lookup */
  const result = await Promise.all(cards.map(async (card) => {
    const statuses = parseStatuses(card.statuses);
    const breakdown = statuses.map(key => ({
      key,
      count: countMap.get(key) ?? 0,
    }));
    const count = breakdown.reduce((a, b) => a + b.count, 0);

    /* Last update: most recent history row for any job currently in one of the card's statuses */
    let lastUpdate: {
      job_id: number; job_no: string; customer_name: string;
      status_to: string | null; at: Date;
    } | null = null;

    if (statuses.length > 0) {
      const [row] = await db.select({
        job_id: repairJobsTable.id,
        job_no: repairJobsTable.job_no,
        customer_name: repairJobsTable.customer_name,
        status_to: repairStatusHistoryTable.status_to,
        at: repairStatusHistoryTable.created_at,
      })
        .from(repairStatusHistoryTable)
        .innerJoin(repairJobsTable, eq(repairStatusHistoryTable.job_id, repairJobsTable.id))
        .where(and(
          eq(repairStatusHistoryTable.company_id, company_id),
          inArray(repairStatusHistoryTable.status_to, statuses),
        ))
        .orderBy(desc(repairStatusHistoryTable.created_at))
        .limit(1);
      if (row) lastUpdate = row;
    }

    return {
      id: card.id,
      name: card.name,
      statuses,
      color: card.color,
      icon: card.icon,
      sort_order: card.sort_order,
      alert_threshold: card.alert_threshold,
      is_system: card.is_system,
      count,
      breakdown,
      last_update: lastUpdate,
    };
  }));

  return res.json({ cards: result, total_all: totalAll });
}));

/* ── Create (admin only) ─────────────────────────────────────────── */
router.post("/repair-dashboard-cards", requireRole("admin", "super_admin"), wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const b = req.body as Record<string, unknown>;

  const name = String(b.name ?? "").trim();
  const statuses = parseStatuses(b.statuses);
  if (!name || statuses.length === 0) {
    return res.status(400).json({ error: "الاسم وحالة واحدة على الأقل مطلوبان" });
  }

  const [maxRow] = await db.select({ m: sql<number>`coalesce(max(${repairDashboardCardsTable.sort_order}), -1)` })
    .from(repairDashboardCardsTable)
    .where(eq(repairDashboardCardsTable.company_id, company_id));
  const nextOrder = Number(maxRow?.m ?? -1) + 1;

  const [row] = await db.insert(repairDashboardCardsTable).values({
    company_id,
    name,
    statuses: JSON.stringify(statuses),
    color: typeof b.color === "string" ? b.color : "#8b5cf6",
    icon:  typeof b.icon  === "string" ? b.icon  : "Wrench",
    sort_order: nextOrder,
    alert_threshold: b.alert_threshold == null ? null : Number(b.alert_threshold),
    is_system: false,
  }).returning();

  return res.status(201).json(row);
}));

/* ── Update (admin only) ─────────────────────────────────────────── */
router.patch("/repair-dashboard-cards/:id", requireRole("admin", "super_admin"), wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const id = Number(req.params.id);
  const b = req.body as Record<string, unknown>;

  const [existing] = await db.select().from(repairDashboardCardsTable)
    .where(and(eq(repairDashboardCardsTable.id, id), eq(repairDashboardCardsTable.company_id, company_id)));
  if (!existing) return res.status(404).json({ error: "الكارت غير موجود" });

  const patch: Record<string, unknown> = { updated_at: new Date() };
  if (typeof b.name === "string" && b.name.trim()) patch.name = b.name.trim();
  if (b.statuses != null) {
    const s = parseStatuses(b.statuses);
    if (s.length === 0) return res.status(400).json({ error: "حالة واحدة على الأقل مطلوبة" });
    patch.statuses = JSON.stringify(s);
  }
  if (typeof b.color === "string") patch.color = b.color;
  if (typeof b.icon === "string") patch.icon = b.icon;
  if (b.alert_threshold !== undefined) patch.alert_threshold = b.alert_threshold == null ? null : Number(b.alert_threshold);

  const [row] = await db.update(repairDashboardCardsTable).set(patch)
    .where(and(eq(repairDashboardCardsTable.id, id), eq(repairDashboardCardsTable.company_id, company_id)))
    .returning();

  return res.json(row);
}));

/* ── Delete (admin only) — protect last card to avoid empty dashboard ── */
router.delete("/repair-dashboard-cards/:id", requireRole("admin", "super_admin"), wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const id = Number(req.params.id);

  const all = await db.select({ id: repairDashboardCardsTable.id })
    .from(repairDashboardCardsTable)
    .where(eq(repairDashboardCardsTable.company_id, company_id));
  if (all.length <= 1) {
    return res.status(400).json({ error: "يجب الإبقاء على كارت واحد على الأقل" });
  }

  await db.delete(repairDashboardCardsTable)
    .where(and(eq(repairDashboardCardsTable.id, id), eq(repairDashboardCardsTable.company_id, company_id)));
  return res.json({ ok: true });
}));

/* ── Reorder (admin only) ────────────────────────────────────────── */
router.post("/repair-dashboard-cards/reorder", requireRole("admin", "super_admin"), wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const b = req.body as { ids?: unknown };
  const ids = Array.isArray(b.ids) ? b.ids.map(Number).filter(Number.isFinite) : [];
  if (ids.length === 0) return res.status(400).json({ error: "ids مطلوبة" });

  await Promise.all(ids.map((id, order) =>
    db.update(repairDashboardCardsTable)
      .set({ sort_order: order, updated_at: new Date() })
      .where(and(eq(repairDashboardCardsTable.id, id), eq(repairDashboardCardsTable.company_id, company_id))),
  ));
  return res.json({ ok: true });
}));

export default router;
