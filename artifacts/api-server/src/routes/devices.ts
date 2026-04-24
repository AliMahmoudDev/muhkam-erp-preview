import { Router } from "express";
import { db } from "@workspace/db";
import { devicesTable } from "@workspace/db";
import { eq, and, desc, or, ilike, sql } from "drizzle-orm";
import { wrap } from "../lib/async-handler";
import type Express from "express";

const router = Router();

function ctx(req: Express.Request) {
  const u = (req as unknown as { user: { company_id: number; id: number; name: string } }).user;
  return { company_id: u.company_id, user_id: u.id, user_name: u.name };
}

/* Auto-generate device number: DEV-YYYY-XXXX */
async function nextDeviceNo(company_id: number): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `DEV-${year}-`;
  const rows = await db.select({ no: devicesTable.device_no })
    .from(devicesTable)
    .where(and(
      eq(devicesTable.company_id, company_id),
      sql`${devicesTable.device_no} LIKE ${prefix + "%"}`
    ))
    .orderBy(desc(devicesTable.id))
    .limit(1);
  if (!rows.length) return `${prefix}0001`;
  const last = rows[0].no;
  const seq = parseInt(last.split("-").pop() ?? "0", 10);
  return `${prefix}${String(seq + 1).padStart(4, "0")}`;
}

/* ─── STATS ─── */
router.get("/devices/stats", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const rows = await db.select({
    status: devicesTable.status,
    count: sql<number>`count(*)::int`,
  })
    .from(devicesTable)
    .where(eq(devicesTable.company_id, company_id))
    .groupBy(devicesTable.status);

  const map: Record<string, number> = {};
  rows.forEach(r => { map[r.status] = r.count; });

  return res.json({
    total:       (map.available ?? 0) + (map.sold ?? 0) + (map.maintenance ?? 0),
    available:   map.available ?? 0,
    sold:        map.sold ?? 0,
    maintenance: map.maintenance ?? 0,
  });
}));

/* ─── LIST ─── */
router.get("/devices", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const { status, search } = req.query as Record<string, string>;

  const conds = [eq(devicesTable.company_id, company_id)];
  if (status && status !== "all") conds.push(eq(devicesTable.status, status));

  let rows = await db.select().from(devicesTable)
    .where(and(...conds))
    .orderBy(desc(devicesTable.created_at));

  if (search?.trim()) {
    const s = search.trim().toLowerCase();
    rows = rows.filter(d =>
      d.brand.toLowerCase().includes(s) ||
      d.model.toLowerCase().includes(s) ||
      d.device_no.toLowerCase().includes(s) ||
      (d.imei && d.imei.toLowerCase().includes(s)) ||
      (d.serial_no && d.serial_no.toLowerCase().includes(s)) ||
      (d.color && d.color.toLowerCase().includes(s)) ||
      (d.sold_to_customer_name && d.sold_to_customer_name.toLowerCase().includes(s))
    );
  }

  return res.json(rows);
}));

/* ─── GET ONE ─── */
router.get("/devices/:id", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const id = Number(req.params.id);
  const [row] = await db.select().from(devicesTable)
    .where(and(eq(devicesTable.id, id), eq(devicesTable.company_id, company_id)));
  if (!row) return res.status(404).json({ error: "not found" });
  return res.json(row);
}));

/* ─── CREATE ─── */
router.post("/devices", wrap(async (req, res) => {
  const { company_id, user_id, user_name } = ctx(req);
  const device_no = await nextDeviceNo(company_id);
  const [row] = await db.insert(devicesTable).values({
    ...req.body,
    company_id,
    device_no,
    added_by_user_id: user_id,
    added_by_user_name: user_name,
    inspector_name: req.body.inspector_name ?? user_name,
    status: "available",
  }).returning();
  return res.json(row);
}));

/* ─── UPDATE ─── */
router.patch("/devices/:id", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const id = Number(req.params.id);
  const [row] = await db.update(devicesTable)
    .set({ ...req.body, updated_at: new Date() })
    .where(and(eq(devicesTable.id, id), eq(devicesTable.company_id, company_id)))
    .returning();
  if (!row) return res.status(404).json({ error: "not found" });
  return res.json(row);
}));

/* ─── SELL ─── */
router.post("/devices/:id/sell", wrap(async (req, res) => {
  const { company_id, user_id, user_name } = ctx(req);
  const id = Number(req.params.id);
  const {
    customer_id, customer_name,
    sold_price, payment_method, payment_status,
    warranty_months, discount_type, discount_value,
  } = req.body;

  const [existing] = await db.select().from(devicesTable)
    .where(and(eq(devicesTable.id, id), eq(devicesTable.company_id, company_id)));
  if (!existing) return res.status(404).json({ error: "not found" });
  if (existing.status !== "available") return res.status(400).json({ error: "الجهاز غير متاح للبيع" });

  const [row] = await db.update(devicesTable).set({
    status: "sold",
    sold_to_customer_id: customer_id ?? null,
    sold_to_customer_name: customer_name ?? null,
    sold_price: sold_price ?? existing.sale_price,
    sold_at: new Date(),
    sold_by_user_id: user_id,
    sold_by_user_name: user_name,
    payment_method: payment_method ?? "cash",
    payment_status: payment_status ?? "paid",
    warranty_months: warranty_months ?? null,
    updated_at: new Date(),
  })
    .where(and(eq(devicesTable.id, id), eq(devicesTable.company_id, company_id)))
    .returning();

  return res.json(row);
}));

/* ─── SEND TO MAINTENANCE ─── */
router.post("/devices/:id/maintenance", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const id = Number(req.params.id);
  const [row] = await db.update(devicesTable)
    .set({ status: "maintenance", updated_at: new Date() })
    .where(and(eq(devicesTable.id, id), eq(devicesTable.company_id, company_id)))
    .returning();
  if (!row) return res.status(404).json({ error: "not found" });
  return res.json(row);
}));

/* ─── RETURN TO AVAILABLE ─── */
router.post("/devices/:id/available", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const id = Number(req.params.id);
  const [row] = await db.update(devicesTable)
    .set({ status: "available", updated_at: new Date() })
    .where(and(eq(devicesTable.id, id), eq(devicesTable.company_id, company_id)))
    .returning();
  if (!row) return res.status(404).json({ error: "not found" });
  return res.json(row);
}));

/* ─── DELETE ─── */
router.delete("/devices/:id", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const id = Number(req.params.id);
  await db.delete(devicesTable)
    .where(and(eq(devicesTable.id, id), eq(devicesTable.company_id, company_id)));
  return res.json({ ok: true });
}));

export default router;
