import { Router, type IRouter } from "express";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { db, purchasesTable, purchaseItemsTable, warehousesTable } from "@workspace/db";
import { wrap } from "../lib/async-handler";
import { requireFeature } from "../middleware/feature-guard";

const router: IRouter = Router();
router.use("/consignment", requireFeature("consignment"));

/* ─── تقرير الائتمان الكامل ─────────────────────────────── */
router.get("/consignment/report", wrap(async (req, res) => {
  const companyId = req.user?.company_id;
  if (!companyId) { res.status(400).json({ error: "company_id مطلوب" }); return; }

  /* 1) كل فواتير الائتمان */
  const purchases = await db
    .select({
      id: purchasesTable.id,
      invoice_no: purchasesTable.invoice_no,
      supplier_name: purchasesTable.supplier_name,
      customer_id: purchasesTable.customer_id,
      date: purchasesTable.date,
      total_amount: purchasesTable.total_amount,
      posting_status: purchasesTable.posting_status,
      consignment_warehouse_id: purchasesTable.consignment_warehouse_id,
      currency: purchasesTable.currency,
      exchange_rate: purchasesTable.exchange_rate,
    })
    .from(purchasesTable)
    .where(and(
      eq(purchasesTable.company_id, companyId),
      eq(purchasesTable.is_consignment, true),
    ))
    .orderBy(desc(purchasesTable.date));

  if (purchases.length === 0) {
    res.json({
      suppliers: [],
      summary: { total_suppliers: 0, total_purchases: 0, grand_total_received: 0, grand_total_owed: 0 },
    });
    return;
  }

  const purchaseIds = purchases.map(p => p.id);

  /* 2) بنود الفواتير */
  const items = await db
    .select()
    .from(purchaseItemsTable)
    .where(inArray(purchaseItemsTable.purchase_id, purchaseIds));
  const itemRows = items as {
    purchase_id: number; product_id: number; product_name: string;
    quantity: string; unit_price: string; total_price: string;
    quantity_returned?: string;
  }[];

  /* 3) الكميات المتبقية في مخازن الائتمان من stock_movements */
  const consWHIds = [...new Set(
    purchases.map(p => p.consignment_warehouse_id).filter(Boolean)
  )] as number[];

  const stockMap: Record<string, number> = {};
  if (consWHIds.length > 0) {
    const stockRows = await db.execute(sql`
      SELECT warehouse_id, product_id, COALESCE(SUM(CAST(quantity AS FLOAT8)), 0) AS remaining_qty
      FROM stock_movements
      WHERE warehouse_id = ANY(ARRAY[${sql.raw(consWHIds.map(Number).join(","))}]::int[])
      GROUP BY warehouse_id, product_id
    `);
    for (const row of stockRows.rows as { warehouse_id: number; product_id: number; remaining_qty: number }[]) {
      stockMap[`${row.warehouse_id}_${row.product_id}`] = Number(row.remaining_qty);
    }
  }

  /* 4) مخازن الائتمان */
  const warehouseMap: Record<number, { name: string; supplier_id: number | null }> = {};
  if (consWHIds.length > 0) {
    const whRows = await db
      .select({ id: warehousesTable.id, name: warehousesTable.name, supplier_id: warehousesTable.supplier_id })
      .from(warehousesTable)
      .where(inArray(warehousesTable.id, consWHIds));
    for (const w of whRows) warehouseMap[w.id] = { name: w.name, supplier_id: w.supplier_id };
  }

  /* 5) تجميع حسب المورد */
  type SupplierEntry = {
    supplier_name: string;
    customer_id: number | null;
    warehouse_id: number | null;
    warehouse_name: string;
    total_received_qty: number;
    total_received_value: number;
    total_remaining_qty: number;
    total_sold_qty: number;
    total_sold_value: number;
    total_owed: number;
    purchases: typeof purchases;
    items: typeof itemRows;
  };

  const bySupplier: Record<string, SupplierEntry> = {};

  /* eslint-disable security/detect-object-injection */
  for (const p of purchases) {
    const key = String(p.customer_id ?? p.supplier_name ?? "unknown");
    const wh = p.consignment_warehouse_id ? warehouseMap[p.consignment_warehouse_id] : null;

    if (!bySupplier[key]) {
      bySupplier[key] = {
        supplier_name: p.supplier_name ?? "مورد غير محدد",
        customer_id: p.customer_id,
        warehouse_id: p.consignment_warehouse_id,
        warehouse_name: wh?.name ?? "مخزن ائتمان",
        purchases: [],
        items: [],
        total_received_qty: 0,
        total_received_value: 0,
        total_remaining_qty: 0,
        total_sold_qty: 0,
        total_sold_value: 0,
        total_owed: 0,
      };
    }

    bySupplier[key].purchases.push(p);

    const pItems = itemRows.filter(i => Number(i.purchase_id) === p.id);
    bySupplier[key].items.push(...pItems);

    for (const item of pItems) {
      const receivedQty = Number(item.quantity);
      const unitPrice   = Number(item.unit_price);

      bySupplier[key].total_received_qty   += receivedQty;
      bySupplier[key].total_received_value += Number(item.total_price);

      const stockKey = `${p.consignment_warehouse_id}_${item.product_id}`;
      const remainingQty = Math.max(0, stockMap[stockKey] ?? 0);
      bySupplier[key].total_remaining_qty += remainingQty;

      const soldQty = Math.max(0, receivedQty - remainingQty);
      bySupplier[key].total_sold_qty   += soldQty;
      bySupplier[key].total_sold_value += soldQty * unitPrice;
      bySupplier[key].total_owed       += soldQty * unitPrice;
    }
  }
  /* eslint-enable security/detect-object-injection */

  res.json({
    suppliers: Object.values(bySupplier),
    summary: {
      total_suppliers: Object.keys(bySupplier).length,
      total_purchases: purchases.length,
      grand_total_received: Object.values(bySupplier).reduce((s, v) => s + v.total_received_value, 0),
      grand_total_owed: Object.values(bySupplier).reduce((s, v) => s + v.total_owed, 0),
    },
  });
}));

/* ─── قائمة مخازن الائتمان ───────────────────────── */
router.get("/consignment/warehouses", wrap(async (req, res) => {
  const companyId = req.user?.company_id;
  if (!companyId) { res.status(400).json({ error: "company_id مطلوب" }); return; }

  const rows = await db
    .select()
    .from(warehousesTable)
    .where(and(
      eq(warehousesTable.company_id, companyId),
      eq(warehousesTable.is_consignment, true),
    ));

  res.json(rows);
}));

/* ─── إنشاء أو إيجاد مخزن ائتمان لمورد ─────────── */
router.post("/consignment/warehouses/ensure", wrap(async (req, res) => {
  const companyId = req.user?.company_id;
  if (!companyId) { res.status(400).json({ error: "company_id مطلوب" }); return; }

  const { supplier_name, supplier_id } = req.body as { supplier_name: string; supplier_id?: number };
  if (!supplier_name) { res.status(400).json({ error: "supplier_name مطلوب" }); return; }

  const warehouseName = `ائتمان — ${supplier_name}`;

  const existing = await db
    .select()
    .from(warehousesTable)
    .where(and(
      eq(warehousesTable.company_id, companyId),
      eq(warehousesTable.name, warehouseName),
    ))
    .limit(1);

  if (existing.length > 0) { res.json(existing[0]); return; }

  const [created] = await db.insert(warehousesTable).values({
    name: warehouseName,
    company_id: companyId,
    is_consignment: true,
    supplier_id: supplier_id ?? null,
  }).returning();

  res.status(201).json(created);
}));

export default router;
