import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, exchangeRatesTable } from "@workspace/db";
import { wrap, httpError } from "../lib/async-handler";
import { z } from "zod/v4";

const router: IRouter = Router();

router.get("/exchange-rates", wrap(async (req, res) => {
  const companyId = req.user?.company_id ?? null;
  const { currency, date } = req.query as { currency?: string; date?: string };

  let conditions: any[] = [];
  if (companyId !== null) conditions.push(eq(exchangeRatesTable.company_id, companyId));
  if (currency) conditions.push(eq(exchangeRatesTable.currency, currency));
  if (date) conditions.push(eq(exchangeRatesTable.date, date));

  const rows = await db.select().from(exchangeRatesTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(exchangeRatesTable.date), desc(exchangeRatesTable.created_at));

  res.json(rows.map(r => ({
    ...r,
    rate: Number(r.rate),
  })));
}));

router.get("/exchange-rates/latest", wrap(async (req, res) => {
  const companyId = req.user?.company_id ?? null;
  const { currency } = req.query as { currency?: string };

  const currencies = currency ? [currency] : ["USD", "CNY", "EUR", "SAR", "AED"];
  const result: Record<string, number> = {};

  for (const cur of currencies) {
    const conditions: any[] = [];
    if (companyId !== null) conditions.push(eq(exchangeRatesTable.company_id, companyId));
    conditions.push(eq(exchangeRatesTable.currency, cur));

    const [row] = await db.select().from(exchangeRatesTable)
      .where(and(...conditions))
      .orderBy(desc(exchangeRatesTable.date), desc(exchangeRatesTable.created_at))
      .limit(1);

    if (row) result[cur] = Number(row.rate);
  }

  res.json(result);
}));

const UpsertExchangeRateBody = z.object({
  currency: z.enum(["USD", "CNY", "EUR", "SAR", "AED"]),
  rate: z.number().positive(),
  date: z.string().optional(),
  notes: z.string().optional(),
});

router.post("/exchange-rates", wrap(async (req, res) => {
  const parsed = UpsertExchangeRateBody.safeParse(req.body);
  if (!parsed.success) throw httpError(400, parsed.error.message);

  const companyId = req.user?.company_id;
  if (!companyId) throw httpError(400, "company_id مطلوب");

  const { currency, rate, notes } = parsed.data;
  const date = parsed.data.date ?? new Date().toISOString().split("T")[0];

  const existing = await db.select({ id: exchangeRatesTable.id })
    .from(exchangeRatesTable)
    .where(and(
      eq(exchangeRatesTable.company_id, companyId),
      eq(exchangeRatesTable.currency, currency),
      eq(exchangeRatesTable.date, date),
    ))
    .limit(1);

  if (existing.length > 0) {
    const [updated] = await db.update(exchangeRatesTable)
      .set({ rate: String(rate), notes: notes ?? null })
      .where(eq(exchangeRatesTable.id, existing[0].id))
      .returning();
    res.json({ ...updated, rate: Number(updated.rate) }); return;
  }

  const [inserted] = await db.insert(exchangeRatesTable).values({
    currency,
    rate: String(rate),
    date,
    company_id: companyId,
    notes: notes ?? null,
  }).returning();

  res.status(201).json({ ...inserted, rate: Number(inserted.rate) });
}));

export default router;
