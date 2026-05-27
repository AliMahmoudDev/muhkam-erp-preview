import { Router, type IRouter } from "express";
import { gte, sum, desc, inArray, and, eq, sql } from "drizzle-orm";
import {
  db, salesTable, saleItemsTable, expensesTable, incomeTable,
  productsTable, transactionsTable, erpUsersTable,
} from "@workspace/db";
import { GetDashboardStatsResponse } from "@workspace/api-zod";
import { wrap } from "../lib/async-handler";
import { getTotalCustomerLedgerBalance, getTotalSupplierLedgerBalance } from "../lib/ledger-balance";
import { getTenant } from "../middleware/auth";
import { z } from "zod/v4";
import { requireUser } from "../lib/tenant";

/* Default shortcuts for new users */
const DEFAULT_SHORTCUTS = [
  "new-sale",
  "new-receipt",
  "new-repair",
  "new-purchase",
];

const ShortcutsBody = z.object({
  shortcuts: z.array(z.string()).max(8),
});

/* Default mobile nav tabs */
const DEFAULT_MOBILE_NAV = ["/", "/sales", "/purchases", "/pos", "/treasury"];

const MobileNavBody = z.object({
  tabs: z.array(z.string().min(1)).max(5),
});

const router: IRouter = Router();

const DashboardStatsQuery = z.object({
  warehouse_id: z.string().regex(/^\d+$/, "معرف المخزن يجب أن يكون رقماً صحيحاً").optional(),
});

router.get("/dashboard/stats", wrap(async (req, res) => {
  const parsedQuery = DashboardStatsQuery.safeParse(req.query);
  if (!parsedQuery.success) {
    res.status(400).json({ error: "معاملات الاستعلام غير صحيحة", details: parsedQuery.error.issues.map(i => i.message) });
    return;
  }

  const role = req.user?.role ?? "cashier";
  const queryWarehouseId = parsedQuery.data.warehouse_id ? parseInt(parsedQuery.data.warehouse_id, 10) : null;
  const effectiveWarehouseId = (role === "admin" || role === "manager")
    ? queryWarehouseId
    : (req.user?.warehouse_id ?? null);
  if ((role === "cashier" || role === "salesperson") && effectiveWarehouseId === null) {
    res.status(403).json({ error: "المستخدم غير مرتبط بمخزن" }); return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];

  // ── company_id مطلوب — يرمي 403 إن لم يكن موجوداً ──────────────────────
  const companyId = getTenant(req);

  // ── مبيعات اليوم ─────────────────────────────────────────────────────────
  const salesDateFilter = and(
    gte(salesTable.date, todayStr),
    effectiveWarehouseId ? eq(salesTable.warehouse_id, effectiveWarehouseId) : undefined,
    eq(salesTable.company_id, companyId),
  );
  const [salesToday] = await db.select({ total: sum(salesTable.total_amount) })
    .from(salesTable).where(salesDateFilter);
  const total_sales_today = Number(salesToday?.total ?? 0);

  // ── مصاريف اليوم ─────────────────────────────────────────────────────────
  const [expensesToday] = await db.select({ total: sum(expensesTable.amount) })
    .from(expensesTable).where(and(
      gte(expensesTable.created_at, today),
      eq(expensesTable.company_id, companyId),
    ));
  const total_expenses_today = Number(expensesToday?.total ?? 0);

  // ── إيرادات اليوم ─────────────────────────────────────────────────────────
  const [incomeToday] = await db.select({ total: sum(incomeTable.amount) })
    .from(incomeTable).where(and(
      gte(incomeTable.created_at, today),
      eq(incomeTable.company_id, companyId),
    ));
  const total_income_today = Number(incomeToday?.total ?? 0);

  // ── صافي الربح: تكلفة المبيعات الفعلية لا إجمالي المبيعات ───────────────
  const todaySales = await db.select({ id: salesTable.id }).from(salesTable).where(salesDateFilter);
  let gross_profit_today = 0;
  if (todaySales.length > 0) {
    const todaySaleIds = todaySales.map(s => s.id);
    const todayItems = await db
      .select({ total_price: saleItemsTable.total_price, cost_total: saleItemsTable.cost_total })
      .from(saleItemsTable)
      .where(inArray(saleItemsTable.sale_id, todaySaleIds));
    gross_profit_today = todayItems.reduce((acc, item) => {
      return acc + (Number(item.total_price) - Number(item.cost_total));
    }, 0);
  }
  const net_profit = gross_profit_today - total_expenses_today + total_income_today;

  // ── ديون العملاء والموردين — من دفتر الأستاذ (AR / AP) ──────────────────
  const [total_customer_debts, total_supplier_debts] = await Promise.all([
    getTotalCustomerLedgerBalance(companyId),
    getTotalSupplierLedgerBalance(companyId),
  ]);

  // ── منتجات منخفضة المخزون — فقط المنتجات التي تجاوزت الحد الأدنى ────────
  const lowStockRows = await db.select({
    id: productsTable.id, name: productsTable.name, sku: productsTable.sku,
    quantity: productsTable.quantity, low_stock_threshold: productsTable.low_stock_threshold,
    cost_price: productsTable.cost_price, sale_price: productsTable.sale_price,
    created_at: productsTable.created_at,
  }).from(productsTable)
    .where(and(
      eq(productsTable.company_id, companyId),
      sql`low_stock_threshold IS NOT NULL AND CAST(quantity AS FLOAT8) <= CAST(low_stock_threshold AS FLOAT8)`,
    ))
    .limit(50);
  const low_stock_products = lowStockRows.map(p => ({
    ...p,
    quantity: Number(p.quantity),
    cost_price: Number(p.cost_price),
    sale_price: Number(p.sale_price),
    created_at: p.created_at.toISOString(),
  }));

  // ── آخر الحركات المالية ───────────────────────────────────────────────────
  const ALLOWED_TX_TYPES = new Set([
    "sale","purchase","expense","income","receipt","payment",
    "sale_return","purchase_return","sale_cash","sale_credit",
    "sale_partial","purchase_cash","purchase_credit","receipt_voucher",
    "payment_voucher","sale_cancel","supplier_payment","safe_closing",
    "safe_adjustment","deposit_voucher",
  ]);
  const recentTxns = await db.select().from(transactionsTable)
    .where(eq(transactionsTable.company_id, companyId))
    .orderBy(desc(transactionsTable.created_at)).limit(50);
  const recent_transactions = recentTxns
    .filter(t => ALLOWED_TX_TYPES.has(t.type))
    .slice(0, 10)
    .map(t => ({
      ...t,
      amount: Number(t.amount),
      created_at: t.created_at.toISOString(),
    }));

  res.json(GetDashboardStatsResponse.parse({
    total_sales_today,
    total_expenses_today,
    total_income_today,
    net_profit: Math.round(net_profit * 100) / 100,
    total_customer_debts,
    total_supplier_debts,
    low_stock_products,
    recent_transactions,
  }));
}));

/* ── GET /dashboard/shortcuts ─────────────────────────────────── */
router.get("/dashboard/shortcuts", wrap(async (req, res) => {
  const userId = requireUser(req).id;
  const companyId = getTenant(req);

  const [row] = await db
    .select({ dashboard_shortcuts: erpUsersTable.dashboard_shortcuts })
    .from(erpUsersTable)
    .where(and(eq(erpUsersTable.id, userId), eq(erpUsersTable.company_id, companyId)));

  const shortcuts = (row?.dashboard_shortcuts as string[] | null) ?? DEFAULT_SHORTCUTS;
  res.json({ shortcuts });
}));

/* ── PUT /dashboard/shortcuts ─────────────────────────────────── */
router.put("/dashboard/shortcuts", wrap(async (req, res) => {
  const parsed = ShortcutsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صحيحة", details: parsed.error.issues.map(i => i.message) });
    return;
  }

  const userId = requireUser(req).id;
  const companyId = getTenant(req);

  await db
    .update(erpUsersTable)
    .set({ dashboard_shortcuts: parsed.data.shortcuts })
    .where(and(eq(erpUsersTable.id, userId), eq(erpUsersTable.company_id, companyId)));

  res.json({ shortcuts: parsed.data.shortcuts });
}));

/* ── GET /dashboard/mobile-nav ────────────────────────────── */
router.get("/dashboard/mobile-nav", wrap(async (req, res) => {
  const userId = requireUser(req).id;
  const companyId = getTenant(req);

  const [row] = await db
    .select({ mobile_nav_tabs: erpUsersTable.mobile_nav_tabs })
    .from(erpUsersTable)
    .where(and(eq(erpUsersTable.id, userId), eq(erpUsersTable.company_id, companyId)));

  const tabs = (row?.mobile_nav_tabs as string[] | null) ?? [];
  res.json({ tabs: tabs.length > 0 ? tabs : DEFAULT_MOBILE_NAV });
}));

/* ── PUT /dashboard/mobile-nav ────────────────────────────── */
router.put("/dashboard/mobile-nav", wrap(async (req, res) => {
  const parsed = MobileNavBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صحيحة", details: parsed.error.issues.map(i => i.message) });
    return;
  }

  const userId = requireUser(req).id;
  const companyId = getTenant(req);

  await db
    .update(erpUsersTable)
    .set({ mobile_nav_tabs: parsed.data.tabs })
    .where(and(eq(erpUsersTable.id, userId), eq(erpUsersTable.company_id, companyId)));

  res.json({ tabs: parsed.data.tabs });
}));

export default router;
