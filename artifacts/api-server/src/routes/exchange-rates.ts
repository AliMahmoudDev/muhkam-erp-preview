import { Router, type IRouter } from "express";
import { eq, and, desc, type SQLWrapper } from "drizzle-orm";
import { z } from "zod/v4";
import { db, exchangeRatesTable } from "@workspace/db";
import { wrap, httpError } from "../lib/async-handler";
import { getTenant } from "../middleware/auth";
import { getCache, setCache, deleteCachePattern } from "../lib/cache";

const CACHE_TTL = 600;

const router: IRouter = Router();

router.get("/exchange-rates", wrap(async (req, res) => {
  const companyId = getTenant(req);
  const { currency, date } = req.query as { currency?: string; date?: string };

  // Include query params in the key so different filter combinations are cached independently
  const cacheKey = `exchange-rates:${companyId}:${currency ?? ""}:${date ?? ""}`;
  const cached = await getCache<object[]>(cacheKey);
  if (cached) { res.json(cached); return; }

  const conditions: SQLWrapper[] = [eq(exchangeRatesTable.company_id, companyId)];
  if (currency) conditions.push(eq(exchangeRatesTable.currency, currency));
  if (date) conditions.push(eq(exchangeRatesTable.date, date));

  const rows = await db.select().from(exchangeRatesTable)
    .where(and(...conditions))
    .orderBy(desc(exchangeRatesTable.date), desc(exchangeRatesTable.created_at));

  const result = rows.map(r => ({ ...r, rate: Number(r.rate) }));
  await setCache(cacheKey, result, CACHE_TTL);
  res.json(result);
}));

router.get("/exchange-rates/latest", wrap(async (req, res) => {
  const companyId = getTenant(req);
  const { currency } = req.query as { currency?: string };

  const currencies = currency ? [currency] : ["USD", "CNY"];
  const result: Record<string, number> = {};

  for (const cur of currencies) {
    const [row] = await db.select().from(exchangeRatesTable)
      .where(and(
        eq(exchangeRatesTable.company_id, companyId),
        eq(exchangeRatesTable.currency, cur),
      ))
      .orderBy(desc(exchangeRatesTable.date), desc(exchangeRatesTable.created_at))
      .limit(1);

    // eslint-disable-next-line security/detect-object-injection
    if (row) result[cur] = Number(row.rate);
  }

  res.json(result);
}));

const UpsertExchangeRateBody = z.object({
  currency: z.enum(["USD", "CNY"]),
  rate: z.number().positive(),
  date: z.string().optional(),
  notes: z.string().optional(),
});

router.post("/exchange-rates", wrap(async (req, res) => {
  const parsed = UpsertExchangeRateBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "بيانات سعر الصرف غير صحيحة", details: parsed.error.issues.map(i => i.message) }); return; }

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

  let responseRow;
  if (existing.length > 0) {
    const [updated] = await db.update(exchangeRatesTable)
      .set({ rate: String(rate), notes: notes ?? null })
      .where(eq(exchangeRatesTable.id, existing[0].id))
      .returning();
    responseRow = { ...updated, rate: Number(updated.rate) };
  } else {
    const [inserted] = await db.insert(exchangeRatesTable).values({
      currency,
      rate: String(rate),
      date,
      company_id: companyId,
      notes: notes ?? null,
    }).returning();
    responseRow = { ...inserted, rate: Number(inserted.rate) };
  }

  // Invalidate all cached exchange-rate keys for this company (any currency/date combo)
  await deleteCachePattern(`exchange-rates:${companyId}:*`);
  res.status(existing.length > 0 ? 200 : 201).json(responseRow);
}));

export default router;
