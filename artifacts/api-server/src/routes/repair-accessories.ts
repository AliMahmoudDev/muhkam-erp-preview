/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  Repair Accessories — قائمة الإكسسوارات المستلمة مع الجهاز               ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 *   GET    /api/repair-accessories        — list (auto-seed defaults on first read)
 *   POST   /api/repair-accessories        — add   (admin)
 *   PATCH  /api/repair-accessories/:id    — edit  (admin)
 *   DELETE /api/repair-accessories/:id    — delete (admin)
 */
import { Router, type IRouter } from "express";
import { eq, and, asc } from "drizzle-orm";
import { db, repairAccessoriesTable } from "@workspace/db";
import { wrap } from "../lib/async-handler";
import { requireRole } from "../middleware/auth";

const router: IRouter = Router();

const ctx = (req: unknown) => {
  const u = (req as { user: { company_id: number; id: number; role: string } }).user;
  return { company_id: u.company_id, user_id: u.id, role: u.role };
};

const DEFAULT_ACCESSORIES = [
  { key_: "charger",   label_ar: "شاحن",     emoji: "🔌" },
  { key_: "box",       label_ar: "علبة",     emoji: "📦" },
  { key_: "case",      label_ar: "جراب",     emoji: "🛡️" },
  { key_: "sim_tray",  label_ar: "درج SIM",  emoji: "📇" },
  { key_: "earphones", label_ar: "سماعة",    emoji: "🎧" },
  { key_: "cable",     label_ar: "كابل",     emoji: "🔗" },
  { key_: "other",     label_ar: "أخرى",     emoji: "✨" },
];

async function ensureDefaults(company_id: number) {
  const existing = await db.select({ id: repairAccessoriesTable.id })
    .from(repairAccessoriesTable)
    .where(eq(repairAccessoriesTable.company_id, company_id))
    .limit(1);
  if (existing.length > 0) return;
  await db.insert(repairAccessoriesTable).values(
    DEFAULT_ACCESSORIES.map((a, i) => ({
      company_id,
      key_: a.key_,
      label_ar: a.label_ar,
      emoji: a.emoji,
      sort_order: i,
      active: true,
      is_system: true,
    })),
  ).onConflictDoNothing();
}

router.get("/repair-accessories", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  await ensureDefaults(company_id);
  const rows = await db.select().from(repairAccessoriesTable)
    .where(eq(repairAccessoriesTable.company_id, company_id))
    .orderBy(asc(repairAccessoriesTable.sort_order), asc(repairAccessoriesTable.id));
  res.json(rows);
}));

router.post("/repair-accessories", requireRole("admin", "super_admin"), wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const { key_, label_ar, emoji, sort_order } = req.body ?? {};
  if (!key_ || !label_ar) { res.status(400).json({ error: "key و label_ar مطلوبان" }); return; }
  const cleanKey = String(key_).trim().toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 40);
  if (!cleanKey) { res.status(400).json({ error: "key غير صالح" }); return; }
  try {
    const [row] = await db.insert(repairAccessoriesTable).values({
      company_id,
      key_: cleanKey,
      label_ar: String(label_ar).trim().slice(0, 80),
      emoji: emoji ? String(emoji).slice(0, 8) : null,
      sort_order: Number(sort_order ?? 999),
      active: true,
      is_system: false,
    }).returning();
    res.json(row);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("unique")) {
      res.status(409).json({ error: "هذا المفتاح موجود بالفعل" }); return;
    }
    throw e;
  }
}));

router.patch("/repair-accessories/:id", requireRole("admin", "super_admin"), wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const id = Number(req.params.id);
  const { label_ar, emoji, sort_order, active } = req.body ?? {};
  const patch: Record<string, unknown> = {};
  if (label_ar !== undefined) patch.label_ar = String(label_ar).trim().slice(0, 80);
  if (emoji !== undefined)    patch.emoji = emoji ? String(emoji).slice(0, 8) : null;
  if (sort_order !== undefined) patch.sort_order = Number(sort_order);
  if (active !== undefined)   patch.active = Boolean(active);
  if (Object.keys(patch).length === 0) { res.status(400).json({ error: "لا يوجد ما يُحدّث" }); return; }
  const [row] = await db.update(repairAccessoriesTable).set(patch)
    .where(and(eq(repairAccessoriesTable.id, id), eq(repairAccessoriesTable.company_id, company_id)))
    .returning();
  if (!row) { res.status(404).json({ error: "غير موجود" }); return; }
  res.json(row);
}));

router.delete("/repair-accessories/:id", requireRole("admin", "super_admin"), wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const id = Number(req.params.id);
  const [row] = await db.select().from(repairAccessoriesTable)
    .where(and(eq(repairAccessoriesTable.id, id), eq(repairAccessoriesTable.company_id, company_id)));
  if (!row) { res.status(404).json({ error: "غير موجود" }); return; }
  await db.delete(repairAccessoriesTable)
    .where(and(eq(repairAccessoriesTable.id, id), eq(repairAccessoriesTable.company_id, company_id)));
  res.json({ success: true });
}));

export default router;
