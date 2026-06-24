/** inventory-control/transfers.ts */
import { Router, type IRouter } from 'express';
import { eq, and, sql, inArray } from 'drizzle-orm';
import {
  db,
  productsTable,
  stockMovementsTable,
  warehousesTable,
} from '@workspace/db';
import { firstZodError } from '../../lib/schemas';
import { createTransferSchema } from './_helpers';
import { wrap } from '../../lib/async-handler';
import { hasPermission } from '../../lib/permissions';
import { writeAuditLog } from '../../lib/audit-log';
import { getTenant } from '../../middleware/auth';

const router: IRouter = Router();

/**
 * POST /api/inventory/transfers
 * ينفّذ تحويل مخزون من مخزن إلى آخر في transaction واحدة
 *
 * Body: {
 *   from_warehouse_id, to_warehouse_id,
 *   notes?,
 *   items: [{ product_id, quantity }]
 * }
 */
router.post(
  '/inventory/transfers',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_adjust_inventory')) {
      res.status(403).json({ error: 'ليس لديك صلاحية تحويل المخزون' });
      return;
    }

    const parsedTransfer = createTransferSchema.safeParse(req.body);
    if (!parsedTransfer.success) {
      res.status(400).json({ error: firstZodError(parsedTransfer.error) });
      return;
    }

    const { from_warehouse_id, to_warehouse_id, items } = parsedTransfer.data;

    // التحقق من عدم التحويل لنفس المخزن
    if (from_warehouse_id === to_warehouse_id) {
      res.status(400).json({ error: 'لا يمكن التحويل من مخزن إلى نفس المخزن' });
      return;
    }

    // ── Aggregate duplicate product lines to prevent stock-check bypass ──────
    const aggregatedMap = new Map<number, number>();
    for (const it of items) {
      const pid = Number(it.product_id);
      const qty = Number(it.quantity);
      aggregatedMap.set(pid, (aggregatedMap.get(pid) ?? 0) + qty);
    }
    const aggregatedItems = Array.from(aggregatedMap.entries()).map(([pid, qty]) => ({
      product_id: pid,
      quantity: qty,
    }));

    // التحقق من أن المخازن موجودة وتنتمي للشركة
    const companyIdT = getTenant(req);
    const [fromWH] = await db
      .select()
      .from(warehousesTable)
      .where(
        and(
          eq(warehousesTable.id, Number(from_warehouse_id)),
          eq(warehousesTable.company_id, companyIdT)
        )
      );
    const [toWH] = await db
      .select()
      .from(warehousesTable)
      .where(
        and(
          eq(warehousesTable.id, Number(to_warehouse_id)),
          eq(warehousesTable.company_id, companyIdT)
        )
      );
    if (!fromWH) {
      res.status(404).json({ error: `مخزن المصدر غير موجود: ${from_warehouse_id}` });
      return;
    }
    if (!toWH) {
      res.status(404).json({ error: `مخزن الهدف غير موجود: ${to_warehouse_id}` });
      return;
    }

    // جلب المنتجات
    const productIds = items.map((i) => i.product_id);
    const products = await db
      .select()
      .from(productsTable)
      .where(and(inArray(productsTable.id, productIds), eq(productsTable.company_id, companyIdT)));
    const productMap = new Map(products.map((p) => [p.id, p]));

    // ─── حساب كمية كل منتج في مخزن المصدر فقط (من حركات المخزون) ─────────────
    // المنطق: SUM(quantity) لكل منتج في هذا المخزن = الرصيد الفعلي الحالي
    // (حركات الدخول موجبة، حركات الخروج سالبة — مسجّلة هكذا في stock_movements)
    const safeIdsCsvT = productIds.map(Number).filter(Number.isInteger).join(',');
    const fromStockRows = safeIdsCsvT
      ? await db.execute(sql`
    SELECT product_id::int,
           COALESCE(SUM(CAST(quantity AS FLOAT8)), 0) AS wh_qty
    FROM   stock_movements
    WHERE  warehouse_id = ${Number(from_warehouse_id)}
      AND  company_id   = ${companyIdT}
      AND  product_id   IN (${sql.raw(safeIdsCsvT)})
    GROUP BY product_id
  `)
      : { rows: [] as Record<string, unknown>[] };
    const fromStockMap = new Map<number, number>(
      (fromStockRows.rows as Array<{ product_id: number; wh_qty: number }>).map((r) => [
        Number(r.product_id),
        Number(r.wh_qty ?? 0),
      ])
    );

    // جلب رصيد مخزن الهدف أيضاً لتسجيل quantity_before صحيح
    const toStockRows = safeIdsCsvT
      ? await db.execute(sql`
    SELECT product_id::int,
           COALESCE(SUM(CAST(quantity AS FLOAT8)), 0) AS wh_qty
    FROM   stock_movements
    WHERE  warehouse_id = ${Number(to_warehouse_id)}
      AND  company_id   = ${companyIdT}
      AND  product_id   IN (${sql.raw(safeIdsCsvT)})
    GROUP BY product_id
  `)
      : { rows: [] as Record<string, unknown>[] };
    const toStockMap = new Map<number, number>(
      (toStockRows.rows as Array<{ product_id: number; wh_qty: number }>).map((r) => [
        Number(r.product_id),
        Number(r.wh_qty ?? 0),
      ])
    );

    // ─── التحقق من توفر الكمية في مخزن المصدر تحديداً (على المجاميع) ───────
    for (const item of aggregatedItems) {
      const product = productMap.get(item.product_id);
      if (!product) {
        res.status(404).json({ error: `المنتج غير موجود: ${item.product_id}` });
        return;
      }
      if (item.quantity <= 0) {
        res.status(400).json({ error: `الكمية يجب أن تكون موجبة للمنتج: ${product.name}` });
        return;
      }
      // الكمية المتاحة في المخزن المصدر (0 إذا لم يسبق نقل أي كمية له)
      const availableInWarehouse = fromStockMap.get(item.product_id) ?? 0;
      if (availableInWarehouse < item.quantity) {
        res.status(400).json({
          error: `الكمية غير كافية في "${fromWH.name}" للمنتج "${product.name}": المتاح ${availableInWarehouse.toFixed(3)}، المطلوب ${item.quantity}`,
          available_in_warehouse: availableInWarehouse,
          warehouse_name: fromWH.name,
        });
        return;
      }
    }

    const transferId = await db.transaction(async (tx) => {
      const today = new Date().toISOString().split('T')[0];
      // رقم مرجعي مؤقت بناءً على الوقت (سيُستبدل بـ id الفعلي بعد الإدراج)
      const tempRef = `WH-TRF-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`;

      for (const item of aggregatedItems) {
        const product = productMap.get(item.product_id)!;
        const qty = Number(item.quantity);

        const fromQtyBefore = fromStockMap.get(item.product_id) ?? 0;
        const fromQtyAfter = fromQtyBefore - qty;
        const toQtyBefore = toStockMap.get(item.product_id) ?? 0;
        const toQtyAfter = toQtyBefore + qty;

        // حركة خروج من المخزن المصدر
        await tx.insert(stockMovementsTable).values({
          product_id: item.product_id,
          product_name: product.name,
          movement_type: 'transfer_out',
          quantity: String(-qty),
          quantity_before: String(fromQtyBefore),
          quantity_after: String(fromQtyAfter),
          unit_cost: product.cost_price,
          reference_type: 'stock_transfer',
          reference_no: tempRef,
          notes: `تحويل مخزن خروج → ${toWH.name}`,
          date: today,
          warehouse_id: Number(from_warehouse_id),
          company_id: getTenant(req),
        });

        // حركة دخول إلى المخزن الهدف
        await tx.insert(stockMovementsTable).values({
          product_id: item.product_id,
          product_name: product.name,
          movement_type: 'transfer_in',
          quantity: String(qty),
          quantity_before: String(toQtyBefore),
          quantity_after: String(toQtyAfter),
          unit_cost: product.cost_price,
          reference_type: 'stock_transfer',
          reference_no: tempRef,
          notes: `تحويل مخزن دخول ← ${fromWH.name}`,
          date: today,
          warehouse_id: Number(to_warehouse_id),
          company_id: getTenant(req),
        });
      }

      return tempRef;
    });

    void writeAuditLog({
      action: 'INVENTORY_TRANSFER',
      record_type: 'product',
      record_id: 0,
      old_value: { from_warehouse: fromWH.name, from_warehouse_id },
      new_value: {
        to_warehouse: toWH.name,
        to_warehouse_id,
        items_count: items.length,
        items: items.map((i) => ({
          product_id: i.product_id,
          product_name: productMap.get(i.product_id)?.name,
          quantity: i.quantity,
        })),
      },
      user: { id: req.user?.id, username: req.user?.username },
    });

    res.status(201).json({
      success: true,
      transfer_id: transferId,
      from_warehouse: fromWH.name,
      to_warehouse: toWH.name,
      items_count: items.length,
    });
  })
);

/**
 * GET /api/inventory/transfers
 * تحويلات المخازن — مُؤقتاً يُعيد حركات المخزون من نوع transfer_out
 * سيُستبدل بـ GET /api/stock-transfers في الخطوة التالية
 */

export default router;
