import { Router, type IRouter } from "express";
import { eq, and, count, sql, desc } from "drizzle-orm";
import { db, fixedAssetsTable, depreciationRunsTable, accountsTable, journalEntriesTable, journalEntryLinesTable } from "@workspace/db";
import { wrap, httpError } from "../lib/async-handler";
import { getOrCreateAccount } from "../lib/auto-account";

const router: IRouter = Router();

type AccountRef = { id: number; code: string; name: string };

interface JLine { account: AccountRef; debit: number; credit: number }

async function postEntry(
  cid: number,
  date: string,
  description: string,
  reference: string,
  lines: JLine[]
): Promise<number> {
  const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01) throw new Error("Journal entry imbalance");

  const [{ total }] = await db.select({ total: count() })
    .from(journalEntriesTable).where(eq(journalEntriesTable.company_id, cid));

  const entryNo = `JE-${String(Number(total) + 1).padStart(5, "0")}`;

  const [entry] = await db.insert(journalEntriesTable).values({
    entry_no: entryNo,
    date,
    description,
    status: "posted",
    reference,
    total_debit: String(totalDebit),
    total_credit: String(totalCredit),
    company_id: cid,
  }).returning({ id: journalEntriesTable.id });

  await db.insert(journalEntryLinesTable).values(
    lines.map(l => ({
      entry_id: entry.id,
      account_id: l.account.id,
      account_code: l.account.code,
      account_name: l.account.name,
      debit: String(l.debit),
      credit: String(l.credit),
    }))
  );

  for (const l of lines) {
    const delta = l.debit - l.credit;
    if (delta === 0) continue;
    await db.update(accountsTable)
      .set({ current_balance: sql`current_balance + ${String(delta)}::numeric` })
      .where(eq(accountsTable.id, l.account.id));
  }

  return entry.id;
}

function fmt(a: typeof fixedAssetsTable.$inferSelect) {
  return {
    ...a,
    purchase_cost: Number(a.purchase_cost),
    residual_value: Number(a.residual_value),
    accumulated_depreciation: Number(a.accumulated_depreciation),
    disposal_proceeds: a.disposal_proceeds ? Number(a.disposal_proceeds) : null,
    book_value: Number(a.purchase_cost) - Number(a.accumulated_depreciation),
    created_at: a.created_at.toISOString(),
  };
}

function calcMonthlyDep(asset: typeof fixedAssetsTable.$inferSelect): number {
  const cost = Number(asset.purchase_cost);
  const residual = Number(asset.residual_value);
  const months = asset.useful_life_months;
  if (asset.depreciation_method === "straight_line") {
    return (cost - residual) / months;
  }
  const bookValue = cost - Number(asset.accumulated_depreciation);
  if (bookValue <= residual) return 0;
  const annualRate = 1 - Math.pow(Math.max(residual / cost, 0.0001), 1 / (months / 12));
  return (bookValue * annualRate) / 12;
}

function buildSchedule(asset: typeof fixedAssetsTable.$inferSelect) {
  const schedule = [];
  let accumulated = 0;
  let bookValue = Number(asset.purchase_cost);
  const residual = Number(asset.residual_value);
  const cost = Number(asset.purchase_cost);
  const months = asset.useful_life_months;
  const parts = asset.purchase_date.split("-").map(Number);
  const startY = parts[0], startM = parts[1];

  for (let i = 0; i < months; i++) {
    let dep = 0;
    if (asset.depreciation_method === "straight_line") {
      dep = (cost - residual) / months;
    } else {
      const annualRate = 1 - Math.pow(Math.max(residual / cost, 0.0001), 1 / (months / 12));
      dep = (bookValue * annualRate) / 12;
    }
    dep = Math.min(dep, bookValue - residual);
    if (dep <= 0.001) break;

    accumulated += dep;
    bookValue -= dep;

    const monthIdx = (startM - 1 + i + 1);
    const month = (monthIdx % 12) + 1;
    const year = startY + Math.floor(monthIdx / 12);
    const period = `${year}-${String(month).padStart(2, "0")}`;

    schedule.push({
      period,
      depreciation: Math.round(dep * 100) / 100,
      accumulated: Math.round(accumulated * 100) / 100,
      book_value: Math.round(bookValue * 100) / 100,
    });
  }
  return schedule;
}

/* GET /api/fixed-assets */
router.get("/fixed-assets", wrap(async (req, res) => {
  const cid = req.user!.company_id!;
  const assets = await db.select().from(fixedAssetsTable)
    .where(eq(fixedAssetsTable.company_id, cid))
    .orderBy(desc(fixedAssetsTable.created_at));
  res.json(assets.map(fmt));
}));

/* POST /api/fixed-assets */
router.post("/fixed-assets", wrap(async (req, res) => {
  const cid = req.user!.company_id!;
  const { name, code, category, description, purchase_date, purchase_cost, residual_value, useful_life_months, depreciation_method } = req.body;

  if (!name || !purchase_date || !purchase_cost || !useful_life_months) {
    throw httpError(400, "البيانات الأساسية ناقصة");
  }

  const safeCode = (code || name).replace(/\s+/g, "-").toUpperCase().slice(0, 20);

  const assetAccount = await getOrCreateAccount(
    { code: `ASSET-FA-${safeCode}`, name: `أصل ثابت - ${name}`, type: "asset" }, cid
  );
  const accDepAccount = await getOrCreateAccount(
    { code: `ASSET-ACCDEPR-${safeCode}`, name: `مجمع إهلاك - ${name}`, type: "asset" }, cid
  );
  const depExpAccount = await getOrCreateAccount(
    { code: `EXP-DEPR-${safeCode}`, name: `مصروف إهلاك - ${name}`, type: "expense" }, cid
  );

  const [asset] = await db.insert(fixedAssetsTable).values({
    name,
    code: safeCode,
    category: category || "equipment",
    description: description || null,
    purchase_date,
    purchase_cost: String(purchase_cost),
    residual_value: String(residual_value || 0),
    useful_life_months: Number(useful_life_months),
    depreciation_method: depreciation_method || "straight_line",
    asset_account_id: assetAccount.id,
    acc_dep_account_id: accDepAccount.id,
    dep_expense_account_id: depExpAccount.id,
    accumulated_depreciation: "0",
    status: "active",
    company_id: cid,
  }).returning();

  res.status(201).json(fmt(asset));
}));

/* GET /api/fixed-assets/:id */
router.get("/fixed-assets/:id", wrap(async (req, res) => {
  const cid = req.user!.company_id!;
  const [asset] = await db.select().from(fixedAssetsTable)
    .where(and(eq(fixedAssetsTable.id, Number(req.params.id)), eq(fixedAssetsTable.company_id, cid)));
  if (!asset) throw httpError(404, "الأصل غير موجود");

  const runs = await db.select().from(depreciationRunsTable)
    .where(and(eq(depreciationRunsTable.asset_id, asset.id), eq(depreciationRunsTable.company_id, cid)))
    .orderBy(depreciationRunsTable.period);

  res.json({
    ...fmt(asset),
    schedule: buildSchedule(asset),
    runs: runs.map(r => ({ ...r, amount: Number(r.amount), created_at: r.created_at.toISOString() })),
  });
}));

/* POST /api/fixed-assets/:id/depreciate */
router.post("/fixed-assets/:id/depreciate", wrap(async (req, res) => {
  const cid = req.user!.company_id!;
  const { period } = req.body;

  if (!period || !/^\d{4}-\d{2}$/.test(period)) throw httpError(400, "الفترة مطلوبة بصيغة YYYY-MM");

  const [asset] = await db.select().from(fixedAssetsTable)
    .where(and(eq(fixedAssetsTable.id, Number(req.params.id)), eq(fixedAssetsTable.company_id, cid)));
  if (!asset) throw httpError(404, "الأصل غير موجود");
  if (asset.status !== "active") throw httpError(400, "الأصل غير نشط");

  const [existingRun] = await db.select().from(depreciationRunsTable)
    .where(and(
      eq(depreciationRunsTable.asset_id, asset.id),
      eq(depreciationRunsTable.period, period),
      eq(depreciationRunsTable.company_id, cid)
    ));
  if (existingRun) throw httpError(409, "تم تنفيذ الإهلاك لهذه الفترة مسبقاً");

  const bookValue = Number(asset.purchase_cost) - Number(asset.accumulated_depreciation);
  const residual = Number(asset.residual_value);
  if (bookValue <= residual) throw httpError(400, "وصل الأصل إلى قيمته الباقية — لا يوجد إهلاك");

  let dep = calcMonthlyDep(asset);
  dep = Math.min(dep, bookValue - residual);
  dep = Math.round(dep * 100) / 100;

  const depExpAccount = await db.select().from(accountsTable)
    .where(and(eq(accountsTable.id, asset.dep_expense_account_id!), eq(accountsTable.company_id, cid)))
    .then(r => r[0]);
  const accDepAccount = await db.select().from(accountsTable)
    .where(and(eq(accountsTable.id, asset.acc_dep_account_id!), eq(accountsTable.company_id, cid)))
    .then(r => r[0]);

  const entryId = await postEntry(cid, `${period}-01`, `إهلاك شهري - ${asset.name} - ${period}`, `DEP-${asset.code}-${period}`, [
    { account: depExpAccount, debit: dep, credit: 0 },
    { account: accDepAccount, debit: 0, credit: dep },
  ]);

  await db.update(fixedAssetsTable)
    .set({ accumulated_depreciation: String(Number(asset.accumulated_depreciation) + dep) })
    .where(and(eq(fixedAssetsTable.id, asset.id), eq(fixedAssetsTable.company_id, cid)));

  const [run] = await db.insert(depreciationRunsTable).values({
    asset_id: asset.id,
    period,
    amount: String(dep),
    entry_id: entryId,
    company_id: cid,
  }).returning();

  res.json({ ...run, amount: Number(run.amount), created_at: run.created_at.toISOString() });
}));

/* POST /api/fixed-assets/:id/dispose */
router.post("/fixed-assets/:id/dispose", wrap(async (req, res) => {
  const cid = req.user!.company_id!;
  const { disposal_date, disposal_proceeds } = req.body;

  if (!disposal_date) throw httpError(400, "تاريخ الاستبعاد مطلوب");

  const [asset] = await db.select().from(fixedAssetsTable)
    .where(and(eq(fixedAssetsTable.id, Number(req.params.id)), eq(fixedAssetsTable.company_id, cid)));
  if (!asset) throw httpError(404, "الأصل غير موجود");
  if (asset.status !== "active") throw httpError(400, "الأصل مستبعد مسبقاً");

  const cost = Number(asset.purchase_cost);
  const accumulated = Number(asset.accumulated_depreciation);
  const bookValue = cost - accumulated;
  const proceeds = Number(disposal_proceeds || 0);
  const gainOrLoss = proceeds - bookValue;

  const assetAccount = await db.select().from(accountsTable)
    .where(and(eq(accountsTable.id, asset.asset_account_id!), eq(accountsTable.company_id, cid))).then(r => r[0]);
  const accDepAccount = await db.select().from(accountsTable)
    .where(and(eq(accountsTable.id, asset.acc_dep_account_id!), eq(accountsTable.company_id, cid))).then(r => r[0]);

  const lines: JLine[] = [
    { account: accDepAccount, debit: accumulated, credit: 0 },
    { account: assetAccount, debit: 0, credit: cost },
  ];

  if (proceeds > 0) {
    const cashAccount = await getOrCreateAccount(
      { code: "ASSET-DISPOSAL-PROCEEDS", name: "حصيلة بيع أصول ثابتة", type: "asset" }, cid
    );
    lines.push({ account: cashAccount, debit: proceeds, credit: 0 });
  }

  if (gainOrLoss > 0) {
    const gainAccount = await getOrCreateAccount(
      { code: "REV-ASSET-DISPOSAL", name: "أرباح بيع أصول ثابتة", type: "revenue" }, cid
    );
    lines.push({ account: gainAccount, debit: 0, credit: gainOrLoss });
  } else if (gainOrLoss < 0) {
    const lossAccount = await getOrCreateAccount(
      { code: "EXP-ASSET-DISPOSAL", name: "خسائر بيع أصول ثابتة", type: "expense" }, cid
    );
    lines.push({ account: lossAccount, debit: Math.abs(gainOrLoss), credit: 0 });
  }

  await postEntry(cid, disposal_date, `استبعاد أصل ثابت - ${asset.name}`, `DISP-${asset.code}`, lines);

  await db.update(fixedAssetsTable)
    .set({ status: "disposed", disposal_date, disposal_proceeds: String(proceeds) })
    .where(and(eq(fixedAssetsTable.id, asset.id), eq(fixedAssetsTable.company_id, cid)));

  res.json({ message: "تم استبعاد الأصل وقيد المحاسبة", gain_loss: gainOrLoss });
}));

export default router;
