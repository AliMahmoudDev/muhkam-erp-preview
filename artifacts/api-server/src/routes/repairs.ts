import { Router, type IRouter } from "express";
import { eq, and, desc, like, or, sql } from "drizzle-orm";
import { db, repairJobsTable, repairJobPartsTable, erpUsersTable } from "@workspace/db";
import { wrap } from "../lib/async-handler";

const router: IRouter = Router();

/* ── helpers ───────────────────────────────────────────────── */
function cid(req: Express.Request) {
  return (req as unknown as { user: { company_id: number } }).user.company_id;
}
function uid(req: Express.Request) {
  return (req as unknown as { user: { id: number; name: string } }).user;
}

async function nextJobNo(companyId: number): Promise<string> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(repairJobsTable)
    .where(eq(repairJobsTable.company_id, companyId));
  const n = (Number(result[0]?.count ?? 0) + 1).toString().padStart(4, "0");
  const year = new Date().getFullYear();
  return `REP-${year}-${n}`;
}

/* ── GET /api/repair-jobs ───────────────────────────────────── */
router.get("/repair-jobs", wrap(async (req, res) => {
  const company_id = cid(req);
  const { status, search } = req.query as Record<string, string>;

  let query = db
    .select()
    .from(repairJobsTable)
    .where(eq(repairJobsTable.company_id, company_id))
    .orderBy(desc(repairJobsTable.created_at))
    .$dynamic();

  if (status && status !== "all") {
    query = query.where(
      and(
        eq(repairJobsTable.company_id, company_id),
        eq(repairJobsTable.status, status)
      )
    );
  }

  const jobs = await query;

  let filtered = jobs;
  if (search?.trim()) {
    const s = search.trim().toLowerCase();
    filtered = jobs.filter(
      (j) =>
        j.customer_name.toLowerCase().includes(s) ||
        j.device_model.toLowerCase().includes(s) ||
        j.device_brand.toLowerCase().includes(s) ||
        j.job_no.toLowerCase().includes(s) ||
        (j.imei && j.imei.includes(s)) ||
        (j.customer_phone && j.customer_phone.includes(s))
    );
  }

  res.json(filtered);
}));

/* ── GET /api/repair-jobs/stats ─────────────────────────────── */
router.get("/repair-jobs/stats", wrap(async (req, res) => {
  const company_id = cid(req);

  const rows = await db
    .select({
      status: repairJobsTable.status,
      count: sql<number>`count(*)`,
    })
    .from(repairJobsTable)
    .where(eq(repairJobsTable.company_id, company_id))
    .groupBy(repairJobsTable.status);

  const stats: Record<string, number> = {};
  for (const r of rows) stats[r.status] = Number(r.count);

  res.json({
    total: Object.values(stats).reduce((a, b) => a + b, 0),
    pending: stats["pending"] ?? 0,
    in_progress: stats["in_progress"] ?? 0,
    done: stats["done"] ?? 0,
    delivered: stats["delivered"] ?? 0,
    cancelled: stats["cancelled"] ?? 0,
  });
}));

/* ── GET /api/repair-jobs/:id ───────────────────────────────── */
router.get("/repair-jobs/:id", wrap(async (req, res) => {
  const company_id = cid(req);
  const id = Number(req.params.id);

  const [job] = await db
    .select()
    .from(repairJobsTable)
    .where(and(eq(repairJobsTable.id, id), eq(repairJobsTable.company_id, company_id)));

  if (!job) return res.status(404).json({ error: "بطاقة الصيانة غير موجودة" });

  const parts = await db
    .select()
    .from(repairJobPartsTable)
    .where(and(eq(repairJobPartsTable.job_id, id), eq(repairJobPartsTable.company_id, company_id)));

  res.json({ ...job, parts });
}));

/* ── POST /api/repair-jobs ──────────────────────────────────── */
router.post("/repair-jobs", wrap(async (req, res) => {
  const company_id = cid(req);
  const body = req.body as Record<string, unknown>;

  const job_no = await nextJobNo(company_id);

  const [job] = await db
    .insert(repairJobsTable)
    .values({
      company_id,
      job_no,
      customer_name: String(body.customer_name ?? ""),
      customer_phone: body.customer_phone ? String(body.customer_phone) : null,
      customer_id: body.customer_id ? Number(body.customer_id) : null,
      device_brand: String(body.device_brand ?? ""),
      device_model: String(body.device_model ?? ""),
      imei: body.imei ? String(body.imei) : null,
      color: body.color ? String(body.color) : null,
      storage: body.storage ? String(body.storage) : null,
      problem_description: body.problem_description ? String(body.problem_description) : null,
      technician_id: body.technician_id ? Number(body.technician_id) : null,
      technician_name: body.technician_name ? String(body.technician_name) : null,
      status: "pending",
      estimated_cost: body.estimated_cost ? String(body.estimated_cost) : "0",
      deposit_paid: body.deposit_paid ? String(body.deposit_paid) : "0",
      received_at: String(body.received_at ?? new Date().toISOString().split("T")[0]),
      estimated_delivery: body.estimated_delivery ? String(body.estimated_delivery) : null,
      notes: body.notes ? String(body.notes) : null,
      checklist: body.checklist ? JSON.stringify(body.checklist) : null,
    })
    .returning();

  res.status(201).json(job);
}));

/* ── PATCH /api/repair-jobs/:id ─────────────────────────────── */
router.patch("/repair-jobs/:id", wrap(async (req, res) => {
  const company_id = cid(req);
  const id = Number(req.params.id);
  const body = req.body as Record<string, unknown>;

  const updates: Record<string, unknown> = { updated_at: new Date() };

  if ("status" in body)               updates.status = body.status;
  if ("technician_id" in body)        updates.technician_id = body.technician_id ? Number(body.technician_id) : null;
  if ("technician_name" in body)      updates.technician_name = body.technician_name;
  if ("problem_description" in body)  updates.problem_description = body.problem_description;
  if ("estimated_cost" in body)       updates.estimated_cost = String(body.estimated_cost);
  if ("final_cost" in body)           updates.final_cost = String(body.final_cost);
  if ("deposit_paid" in body)         updates.deposit_paid = String(body.deposit_paid);
  if ("estimated_delivery" in body)   updates.estimated_delivery = body.estimated_delivery;
  if ("notes" in body)                updates.notes = body.notes;
  if ("device_score" in body)         updates.device_score = body.device_score ? Number(body.device_score) : null;
  if ("checklist" in body)            updates.checklist = JSON.stringify(body.checklist);
  if ("imei" in body)                 updates.imei = body.imei;
  if ("color" in body)                updates.color = body.color;
  if ("storage" in body)              updates.storage = body.storage;
  if (body.status === "delivered")    updates.delivered_at = new Date().toISOString().split("T")[0];

  const [updated] = await db
    .update(repairJobsTable)
    .set(updates)
    .where(and(eq(repairJobsTable.id, id), eq(repairJobsTable.company_id, company_id)))
    .returning();

  if (!updated) return res.status(404).json({ error: "غير موجود" });
  res.json(updated);
}));

/* ── DELETE /api/repair-jobs/:id ────────────────────────────── */
router.delete("/repair-jobs/:id", wrap(async (req, res) => {
  const company_id = cid(req);
  const id = Number(req.params.id);

  await db.delete(repairJobPartsTable).where(eq(repairJobPartsTable.job_id, id));
  await db
    .delete(repairJobsTable)
    .where(and(eq(repairJobsTable.id, id), eq(repairJobsTable.company_id, company_id)));

  res.json({ ok: true });
}));

/* ── POST /api/repair-jobs/:id/parts ────────────────────────── */
router.post("/repair-jobs/:id/parts", wrap(async (req, res) => {
  const company_id = cid(req);
  const job_id = Number(req.params.id);
  const body = req.body as Record<string, unknown>;

  const [part] = await db
    .insert(repairJobPartsTable)
    .values({
      job_id,
      company_id,
      product_id: body.product_id ? Number(body.product_id) : null,
      product_name: String(body.product_name ?? ""),
      quantity: String(body.quantity ?? "1"),
      unit_price: String(body.unit_price ?? "0"),
    })
    .returning();

  res.status(201).json(part);
}));

/* ── DELETE /api/repair-jobs/:id/parts/:partId ──────────────── */
router.delete("/repair-jobs/:id/parts/:partId", wrap(async (req, res) => {
  const company_id = cid(req);
  const partId = Number(req.params.partId);

  await db
    .delete(repairJobPartsTable)
    .where(and(eq(repairJobPartsTable.id, partId), eq(repairJobPartsTable.company_id, company_id)));

  res.json({ ok: true });
}));

/* ── GET /api/repair-jobs/technicians ──────────────────────── */
router.get("/repair-jobs/technicians", wrap(async (req, res) => {
  const company_id = cid(req);
  const users = await db
    .select({ id: erpUsersTable.id, name: erpUsersTable.name })
    .from(erpUsersTable)
    .where(eq(erpUsersTable.company_id, company_id));
  res.json(users);
}));

export default router;
