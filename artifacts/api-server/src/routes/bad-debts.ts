import { Router, type IRouter } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { db, badDebtsTable } from "@workspace/db";
import { wrap } from "../lib/async-handler";
import { z } from "zod/v4";

const router: IRouter = Router();

function ctx(req: Express.Request) {
  const u = (req as unknown as { user: { company_id: number; id: number; name: string } }).user;
  return { company_id: u.company_id, user_id: u.id, user_name: u.name };
}

const CreateBadDebtBody = z.object({
  customer_name:        z.string().min(1, "اسم العميل مطلوب"),
  amount:               z.number().positive("المبلغ يجب أن يكون رقماً موجباً"),
  customer_id:          z.number().int().positive().nullish(),
  reason:               z.string().nullish(),
  account_id:           z.number().int().positive().nullish(),
  status:               z.enum(["open", "written_off", "recovered"]).optional().default("open"),
  source_invoice_id:    z.number().int().positive().nullish(),
  source_repair_job_id: z.number().int().positive().nullish(),
  notes:                z.string().nullish(),
});

const UpdateBadDebtBody = z.object({
  status: z.enum(["open", "written_off", "recovered"]).optional(),
  amount: z.number().positive("المبلغ يجب أن يكون رقماً موجباً").optional(),
  reason: z.string().nullish(),
  notes:  z.string().nullish(),
});

router.get("/bad-debts", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const status = typeof req.query.status === "string" ? req.query.status : null;
  const where = status
    ? and(eq(badDebtsTable.company_id, company_id), eq(badDebtsTable.status, status))
    : eq(badDebtsTable.company_id, company_id);
  const rows = await db.select().from(badDebtsTable).where(where).orderBy(desc(badDebtsTable.created_at));
  return res.json(rows);
}));

router.get("/bad-debts/stats", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const [r] = await db.select({
    count: sql<number>`count(*)`,
    total_amount: sql<number>`COALESCE(sum(${badDebtsTable.amount}), 0)`,
    open_amount: sql<number>`COALESCE(sum(case when ${badDebtsTable.status} = 'open' then ${badDebtsTable.amount} else 0 end), 0)`,
    written_off_amount: sql<number>`COALESCE(sum(case when ${badDebtsTable.status} = 'written_off' then ${badDebtsTable.amount} else 0 end), 0)`,
    recovered_amount: sql<number>`COALESCE(sum(case when ${badDebtsTable.status} = 'recovered' then ${badDebtsTable.amount} else 0 end), 0)`,
  }).from(badDebtsTable).where(eq(badDebtsTable.company_id, company_id));
  return res.json({
    count: Number(r?.count ?? 0),
    total_amount: Number(r?.total_amount ?? 0),
    open_amount: Number(r?.open_amount ?? 0),
    written_off_amount: Number(r?.written_off_amount ?? 0),
    recovered_amount: Number(r?.recovered_amount ?? 0),
  });
}));

router.post("/bad-debts", wrap(async (req, res) => {
  const { company_id, user_id, user_name } = ctx(req);

  const parsed = CreateBadDebtBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "بيانات الديون المعدومة غير صحيحة", details: parsed.error.issues.map(i => i.message) });
  }

  const { customer_name, amount, customer_id, reason, account_id, status, source_invoice_id, source_repair_job_id, notes } = parsed.data;

  const [row] = await db.insert(badDebtsTable).values({
    company_id,
    customer_id:          customer_id ?? null,
    customer_name,
    amount:               String(amount),
    reason:               reason ?? null,
    account_id:           account_id ?? null,
    status,
    source_invoice_id:    source_invoice_id ?? null,
    source_repair_job_id: source_repair_job_id ?? null,
    notes:                notes ?? null,
    written_off_at:       status === "written_off" ? new Date().toISOString().split("T")[0] : null,
    created_by:           user_id,
    created_by_name:      user_name,
  }).returning();
  return res.status(201).json(row);
}));

router.patch("/bad-debts/:id", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const id = Number(req.params.id);

  const parsed = UpdateBadDebtBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "بيانات التحديث غير صحيحة", details: parsed.error.issues.map(i => i.message) });
  }

  const { status, amount, reason, notes } = parsed.data;
  const updates: Record<string, unknown> = {};

  if (status !== undefined) {
    updates.status = status;
    if (status === "written_off") updates.written_off_at = new Date().toISOString().split("T")[0];
  }
  if (amount !== undefined) updates.amount = String(amount);
  if (reason !== undefined) updates.reason = reason ?? null;
  if (notes  !== undefined) updates.notes  = notes  ?? null;

  if (Object.keys(updates).length === 0) return res.status(400).json({ error: "لا توجد تغييرات" });

  const [row] = await db.update(badDebtsTable)
    .set(updates)
    .where(and(eq(badDebtsTable.id, id), eq(badDebtsTable.company_id, company_id)))
    .returning();
  if (!row) return res.status(404).json({ error: "غير موجود" });
  return res.json(row);
}));

router.delete("/bad-debts/:id", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const id = Number(req.params.id);
  await db.delete(badDebtsTable)
    .where(and(eq(badDebtsTable.id, id), eq(badDebtsTable.company_id, company_id)));
  return res.json({ ok: true });
}));

export default router;
