import { Router, type IRouter, type Request } from "express";
import { eq, asc, and, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, accountsTable, journalEntriesTable, journalEntryLinesTable } from "@workspace/db";
import { wrap } from "../lib/async-handler";
import { requireFeature } from "../middleware/feature-guard";
import { setCache, getCache, deleteCache } from "../lib/cache";
import { getTenant } from "../middleware/auth";

const ACCOUNT_TYPES = ["asset", "liability", "equity", "revenue", "expense"] as const;

const createAccountSchema = z.object({
  code: z.string({ required_error: "رمز الحساب مطلوب" }).min(1).max(50),
  name: z.string({ required_error: "اسم الحساب مطلوب" }).min(1).max(200),
  type: z.enum(ACCOUNT_TYPES, { errorMap: () => ({ message: "نوع الحساب غير صحيح" }) }),
  parent_id: z.number().int().positive().optional().nullable(),
  level: z.number().int().min(1).max(10).optional(),
  is_posting: z.boolean().optional(),
  opening_balance: z.number().optional(),
});

const updateAccountSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  is_active: z.boolean().optional(),
  is_posting: z.boolean().optional(),
});

const journalLineSchema = z.object({
  account_id: z.number().int().positive({ message: "معرّف الحساب مطلوب" }),
  account_name: z.string().optional(),
  account_code: z.string().optional(),
  debit: z.number().min(0).optional().default(0),
  credit: z.number().min(0).optional().default(0),
  description: z.string().max(500).optional().nullable(),
});

const createJournalEntrySchema = z.object({
  date: z.string({ required_error: "تاريخ القيد مطلوب" }).min(1),
  description: z.string({ required_error: "وصف القيد مطلوب" }).min(1).max(500),
  reference: z.string().max(100).optional().nullable(),
  status: z.enum(["draft", "posted"]).optional().default("draft"),
  lines: z.array(journalLineSchema).min(2, "يجب إضافة سطرين على الأقل"),
});

const router: IRouter = Router();
router.use("/accounts", requireFeature("accounting"));

function getCid(req: Request): number {
  return getTenant(req);
}

function fmt(a: typeof accountsTable.$inferSelect) {
  return { ...a, opening_balance: Number(a.opening_balance), current_balance: Number(a.current_balance) };
}

function fmtEntry(e: typeof journalEntriesTable.$inferSelect) {
  return {
    ...e,
    total_debit: Number(e.total_debit),
    total_credit: Number(e.total_credit),
    created_at: e.created_at.toISOString(),
  };
}

// ── دليل الحسابات ──────────────────────────────────────────
router.get("/accounts", wrap(async (req, res) => {
  const cid = getCid(req);
  const cacheKey = `coa:${cid}`;
  const cached = await getCache<ReturnType<typeof fmt>[]>(cacheKey);
  if (cached) { res.json(cached); return; }
  const accounts = await db.select().from(accountsTable)
    .where(eq(accountsTable.company_id, cid))
    .orderBy(asc(accountsTable.code));
  const result = accounts.map(fmt);
  await setCache(cacheKey, result, 600);
  res.json(result);
}));

router.post("/accounts", wrap(async (req, res) => {
  const cid = getCid(req);
  const v = createAccountSchema.safeParse(req.body);
  if (!v.success) { res.status(400).json({ error: v.error.errors[0]?.message ?? "بيانات غير صالحة" }); return; }
  const { code, name, type, parent_id, level, is_posting, opening_balance } = v.data;
  const [acc] = await db.insert(accountsTable).values({
    code, name, type,
    parent_id: parent_id ?? null,
    level: level ?? 1,
    is_posting: is_posting !== false,
    opening_balance: String(opening_balance ?? 0),
    current_balance: String(opening_balance ?? 0),
    company_id: cid,
  }).returning();
  await deleteCache(`coa:${cid}`);
  res.status(201).json(fmt(acc));
}));

router.put("/accounts/:id", wrap(async (req, res) => {
  const cid = getCid(req);
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: "معرّف غير صالح" }); return; }
  const v = updateAccountSchema.safeParse(req.body);
  if (!v.success) { res.status(400).json({ error: v.error.errors[0]?.message ?? "بيانات غير صالحة" }); return; }
  const { name, is_active, is_posting } = v.data;
  const [acc] = await db.update(accountsTable)
    .set({ name, is_active, is_posting })
    .where(and(eq(accountsTable.id, id), eq(accountsTable.company_id, cid))).returning();
  if (!acc) { res.status(404).json({ error: "الحساب غير موجود" }); return; }
  await deleteCache(`coa:${cid}`);
  res.json(fmt(acc));
}));

router.delete("/accounts/:id", wrap(async (req, res) => {
  const cid = getCid(req);
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: "معرّف غير صالح" }); return; }
  await db.delete(accountsTable).where(and(eq(accountsTable.id, id), eq(accountsTable.company_id, cid)));
  await deleteCache(`coa:${cid}`);
  res.json({ success: true });
}));

// ── القيود اليومية ─────────────────────────────────────────
router.get("/journal-entries", wrap(async (req, res) => {
  const cid = getCid(req);
  const entries = await db.select().from(journalEntriesTable)
    .where(eq(journalEntriesTable.company_id, cid))
    .orderBy(journalEntriesTable.created_at);
  res.json(entries.map(fmtEntry).reverse());
}));

router.get("/journal-entries/:id", wrap(async (req, res) => {
  const cid = getCid(req);
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: "معرّف غير صالح" }); return; }
  const [entry] = await db.select().from(journalEntriesTable)
    .where(and(eq(journalEntriesTable.id, id), eq(journalEntriesTable.company_id, cid)));
  if (!entry) { res.status(404).json({ error: "غير موجود" }); return; }
  const lines = await db.select().from(journalEntryLinesTable)
    .where(eq(journalEntryLinesTable.entry_id, id));
  res.json({
    ...fmtEntry(entry),
    lines: lines.map(l => ({ ...l, debit: Number(l.debit), credit: Number(l.credit) })),
  });
}));

router.post("/journal-entries", wrap(async (req, res) => {
  const cid = getCid(req);
  const v = createJournalEntrySchema.safeParse(req.body);
  if (!v.success) { res.status(400).json({ error: v.error.errors[0]?.message ?? "بيانات غير صالحة" }); return; }
  const { date, description, reference, lines, status } = v.data;
  const totalDebit = lines.reduce((s: number, l: { debit?: number }) => s + (l.debit ?? 0), 0);
  const totalCredit = lines.reduce((s: number, l: { credit?: number }) => s + (l.credit ?? 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    res.status(400).json({ error: "القيد غير متوازن — المدين لا يساوي الدائن" });
    return;
  }
  const allEntries = await db.select().from(journalEntriesTable)
    .where(eq(journalEntriesTable.company_id, cid));
  const entry_no = `JE-${String(allEntries.length + 1).padStart(5, "0")}`;
  const [entry] = await db.insert(journalEntriesTable).values({
    entry_no, date, description,
    reference: reference ?? null,
    status: status ?? "draft",
    total_debit: String(totalDebit),
    total_credit: String(totalCredit),
    company_id: cid,
  }).returning();

  // ── Prefetch all referenced accounts in ONE query (N+1 fix) ──
  const accountIds = [...new Set(lines.map(l => l.account_id))];
  const accountRows = accountIds.length > 0
    ? await db.select().from(accountsTable).where(and(inArray(accountsTable.id, accountIds), eq(accountsTable.company_id, cid)))
    : [];
  const accountMap = new Map(accountRows.map(a => [a.id, a]));

  // ── Batch-insert all journal entry lines ──
  const lineValues = lines.map(line => {
    const acc = accountMap.get(line.account_id);
    return {
      entry_id: entry.id,
      account_id: line.account_id,
      account_name: acc?.name ?? line.account_name ?? "",
      account_code: acc?.code ?? line.account_code ?? "",
      debit: String(line.debit ?? 0),
      credit: String(line.credit ?? 0),
      description: line.description ?? null,
    };
  });
  if (lineValues.length > 0) {
    await db.insert(journalEntryLinesTable).values(lineValues);
  }

  // ── Update account balances if posted ──
  if (status === "posted") {
    for (const line of lines) {
      const acc = accountMap.get(line.account_id);
      if (!acc) continue;
      const impact = (acc.type === "asset" || acc.type === "expense")
        ? (line.debit ?? 0) - (line.credit ?? 0)
        : (line.credit ?? 0) - (line.debit ?? 0);
      if (impact !== 0) {
        await db.update(accountsTable)
          .set({ current_balance: String(Number(acc.current_balance) + impact) })
          .where(eq(accountsTable.id, acc.id));
        // Update local map for potential duplicate account_ids in same entry
        acc.current_balance = String(Number(acc.current_balance) + impact);
      }
    }
  }

  res.status(201).json(fmtEntry(entry));
}));

router.patch("/journal-entries/:id/post", wrap(async (req, res) => {
  const cid = getCid(req);
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: "معرّف غير صالح" }); return; }
  const [entry] = await db.update(journalEntriesTable)
    .set({ status: "posted" })
    .where(and(eq(journalEntriesTable.id, id), eq(journalEntriesTable.company_id, cid))).returning();
  if (!entry) { res.status(404).json({ error: "غير موجود" }); return; }

  const lines = await db.select().from(journalEntryLinesTable).where(eq(journalEntryLinesTable.entry_id, id));

  // ── Prefetch all accounts referenced by lines in ONE query (N+1 fix) ──
  const accountIds = [...new Set(lines.map(l => l.account_id))];
  const accountRows = accountIds.length > 0
    ? await db.select().from(accountsTable).where(inArray(accountsTable.id, accountIds))
    : [];
  const accountMap = new Map(accountRows.map(a => [a.id, a]));

  // ── Compute and apply balance impacts ──
  for (const line of lines) {
    const acc = accountMap.get(line.account_id);
    if (!acc) continue;
    const impact = (acc.type === "asset" || acc.type === "expense")
      ? Number(line.debit) - Number(line.credit)
      : Number(line.credit) - Number(line.debit);
    if (impact !== 0) {
      await db.update(accountsTable)
        .set({ current_balance: String(Number(acc.current_balance) + impact) })
        .where(eq(accountsTable.id, acc.id));
      // Update local map for duplicate account_ids
      acc.current_balance = String(Number(acc.current_balance) + impact);
    }
  }
  res.json(fmtEntry(entry));
}));

router.delete("/journal-entries/:id", wrap(async (req, res) => {
  const cid = getCid(req);
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: "معرّف غير صالح" }); return; }
  const [entry] = await db.select({ id: journalEntriesTable.id, status: journalEntriesTable.status })
    .from(journalEntriesTable)
    .where(and(eq(journalEntriesTable.id, id), eq(journalEntriesTable.company_id, cid)));
  if (!entry) { res.status(404).json({ error: "غير موجود" }); return; }
  if (entry.status === "posted") { res.status(400).json({ error: "لا يمكن حذف قيد منشور — استخدم عكس القيد" }); return; }
  await db.delete(journalEntryLinesTable).where(eq(journalEntryLinesTable.entry_id, id));
  await db.delete(journalEntriesTable).where(eq(journalEntriesTable.id, id));
  res.json({ success: true });
}));

/* ── عكس القيد (Reversal) ──────────────────────────────────────────── */
router.post("/journal-entries/:id/reverse", wrap(async (req, res) => {
  const cid = getCid(req);
  const id  = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: "معرّف غير صالح" }); return; }

  const [original] = await db.select()
    .from(journalEntriesTable)
    .where(and(eq(journalEntriesTable.id, id), eq(journalEntriesTable.company_id, cid)));
  if (!original) { res.status(404).json({ error: "القيد غير موجود" }); return; }
  if (original.status !== "posted") { res.status(400).json({ error: "يمكن عكس القيود المنشورة فقط" }); return; }

  const origLines = await db.select().from(journalEntryLinesTable).where(eq(journalEntryLinesTable.entry_id, id));
  if (!origLines.length) { res.status(400).json({ error: "القيد لا يحتوي على بنود" }); return; }

  const today = new Date().toISOString().split("T")[0];

  const reversalEntry = await db.transaction(async (tx) => {
    // 1. إنشاء قيد العكس
    const [rev] = await tx.insert(journalEntriesTable).values({
      entry_no:     `REV-${original.entry_no}`,
      date:         today,
      description:  `عكس القيد: ${original.description}`,
      status:       "posted",
      reference:    `REV-${id}`,
      total_debit:  original.total_credit,
      total_credit: original.total_debit,
      company_id:   cid,
    }).returning();

    // 2. Prefetch all accounts referenced by lines in ONE query (N+1 fix)
    const accountIds = [...new Set(origLines.map(l => l.account_id))];
    const accountRows = accountIds.length > 0
      ? await tx.select().from(accountsTable).where(inArray(accountsTable.id, accountIds))
      : [];
    const accountMap = new Map(accountRows.map(a => [a.id, a]));

    // 3. Batch-insert all reversal lines
    const reversalLineValues = origLines.map(line => ({
      entry_id:     rev.id,
      account_id:   line.account_id,
      account_name: line.account_name,
      account_code: line.account_code,
      debit:        line.credit,
      credit:       line.debit,
      description:  line.description,
    }));
    if (reversalLineValues.length > 0) {
      await tx.insert(journalEntryLinesTable).values(reversalLineValues);
    }

    // 4. Update account balances (reverse impacts)
    for (const line of origLines) {
      const acc = accountMap.get(line.account_id);
      if (!acc) continue;
      const reverseImpact = (acc.type === "asset" || acc.type === "expense")
        ? Number(line.credit) - Number(line.debit)
        : Number(line.debit) - Number(line.credit);
      if (reverseImpact !== 0) {
        await tx.update(accountsTable)
          .set({ current_balance: String(Number(acc.current_balance) + reverseImpact) })
          .where(eq(accountsTable.id, acc.id));
        // Update local map for duplicate account_ids
        acc.current_balance = String(Number(acc.current_balance) + reverseImpact);
      }
    }

    // 5. تعيين القيد الأصلي كمعكوس
    await tx.update(journalEntriesTable)
      .set({ status: "reversed", reference: `REVERSED-BY-${rev.id}` })
      .where(eq(journalEntriesTable.id, id));

    return rev;
  });

  res.json({ success: true, reversal_entry: fmtEntry(reversalEntry) });
}));

export default router;
