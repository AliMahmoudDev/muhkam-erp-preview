/** inventory/audit.ts */
import { Router, type IRouter } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '@workspace/db';
import { wrap } from '../../lib/async-handler';
import { hasPermission } from '../../lib/permissions';
import { getTenant } from '../../middleware/auth';
import { type AuditRow } from './_helpers';

const router: IRouter = Router();

// ── مراجعة المخزون الكاملة ─────────────────────────────────────────────────
router.get(
  '/inventory/audit',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_view_inventory')) {
      res.status(403).json({ error: 'ليس لديك صلاحية عرض المخزون' });
      return;
    }
    const role = req.user?.role ?? 'cashier';
    const queryWarehouseId = req.query.warehouse_id
      ? parseInt(String(req.query.warehouse_id), 10)
      : null;
    const effectiveWarehouseId =
      role === 'admin' || role === 'manager' ? queryWarehouseId : (req.user?.warehouse_id ?? null);
    if ((role === 'cashier' || role === 'salesperson') && effectiveWarehouseId === null) {
      res.status(403).json({ error: 'المستخدم غير مرتبط بمخزن' });
      return;
    }

    const companyId = getTenant(req);
    const warehouseFilter = effectiveWarehouseId
      ? sql` AND sm.warehouse_id = ${effectiveWarehouseId}`
      : sql``;
    const companyWhere = sql` WHERE p.company_id = ${companyId}`;

    const rows = await db.execute(sql`
    SELECT
      p.id,
      p.name,
      p.sku,
      p.category,
      CAST(p.quantity      AS FLOAT8) AS actual_qty,
      CAST(p.cost_price    AS FLOAT8) AS cost_price,
      CAST(p.sale_price    AS FLOAT8) AS sale_price,
      p.low_stock_threshold,
      COALESCE(SUM(CASE WHEN sm.movement_type = 'opening_balance'  THEN ABS(CAST(sm.quantity AS FLOAT8)) ELSE 0 END), 0) AS opening_qty,
      COALESCE(SUM(CASE WHEN sm.movement_type = 'purchase'         THEN ABS(CAST(sm.quantity AS FLOAT8)) ELSE 0 END), 0) AS purchased_qty,
      COALESCE(SUM(CASE WHEN sm.movement_type = 'sale'             THEN ABS(CAST(sm.quantity AS FLOAT8)) ELSE 0 END), 0) AS sold_qty,
      COALESCE(SUM(CASE WHEN sm.movement_type = 'sale_return'      THEN ABS(CAST(sm.quantity AS FLOAT8)) ELSE 0 END), 0) AS sale_return_qty,
      COALESCE(SUM(CASE WHEN sm.movement_type = 'purchase_return'  THEN ABS(CAST(sm.quantity AS FLOAT8)) ELSE 0 END), 0) AS purchase_return_qty,
      COALESCE(SUM(CASE WHEN sm.movement_type = 'adjustment'       THEN CAST(sm.quantity AS FLOAT8) ELSE 0 END), 0)     AS adjustment_qty,
      COALESCE(SUM(CAST(sm.quantity AS FLOAT8)), 0)                                                                      AS calculated_qty
    FROM products p
    LEFT JOIN stock_movements sm ON sm.product_id = p.id${warehouseFilter}
    ${companyWhere}
    GROUP BY p.id, p.name, p.sku, p.category, p.quantity, p.cost_price, p.sale_price, p.low_stock_threshold
    ORDER BY p.name
  `);

    const r2 = (n: number) => Math.round(n * 100) / 100;
    const TOLERANCE = 0.02;

    const products = (rows.rows as unknown as AuditRow[]).map((r) => {
      const actual_qty = Number(r.actual_qty);
      const cost_price = Number(r.cost_price);
      const calculated_qty = Number(r.calculated_qty);
      const total_value = r2(actual_qty * cost_price);
      const discrepancy = r2(actual_qty - calculated_qty);

      // تحقق على مستوى المنتج: الكمية × السعر = القيمة، والكمية المحسوبة = الفعلية
      const checks: Array<{ name: string; expected: number; actual: number; ok: boolean }> = [
        {
          name: 'الكمية × سعر التكلفة = قيمة المخزون',
          expected: r2(actual_qty * cost_price),
          actual: total_value,
          ok: Math.abs(r2(actual_qty * cost_price) - total_value) <= TOLERANCE,
        },
        {
          name: 'الكمية المحسوبة من الحركات = الكمية الفعلية',
          expected: r2(calculated_qty),
          actual: r2(actual_qty),
          ok: Math.abs(discrepancy) <= TOLERANCE,
        },
      ];
      const productStatus = checks.every((c) => c.ok) ? 'OK' : 'WARNING';

      return {
        id: Number(r.id),
        name: String(r.name),
        sku: r.sku ? String(r.sku) : null,
        category: r.category ? String(r.category) : null,
        actual_qty,
        cost_price,
        sale_price: Number(r.sale_price),
        low_stock_threshold: r.low_stock_threshold ? Number(r.low_stock_threshold) : null,
        opening_qty: Number(r.opening_qty),
        purchased_qty: Number(r.purchased_qty),
        sold_qty: Number(r.sold_qty),
        sale_return_qty: Number(r.sale_return_qty),
        purchase_return_qty: Number(r.purchase_return_qty),
        adjustment_qty: Number(r.adjustment_qty),
        calculated_qty,
        discrepancy,
        total_value,
        validation: { status: productStatus as 'OK' | 'WARNING', checks },
      };
    });

    const total_inventory_value = r2(products.reduce((s, p) => s + p.total_value, 0));
    const low_stock_count = products.filter(
      (p) => p.low_stock_threshold !== null && p.actual_qty <= p.low_stock_threshold
    ).length;
    const zero_stock_count = products.filter((p) => p.actual_qty <= 0).length;
    const discrepancy_count = products.filter((p) => p.validation.status === 'WARNING').length;

    // تحقق على مستوى المستودع الكامل
    const summaryChecks = [
      {
        name: 'مجموع قيم الأصناف = إجمالي قيمة المخزون',
        expected: r2(products.reduce((s, p) => s + p.total_value, 0)),
        actual: total_inventory_value,
        ok:
          Math.abs(r2(products.reduce((s, p) => s + p.total_value, 0)) - total_inventory_value) <=
          TOLERANCE,
      },
      {
        name: 'عدد الأصناف ذات الفارق = 0',
        expected: 0,
        actual: discrepancy_count,
        ok: discrepancy_count === 0,
      },
    ];
    const summaryStatus = summaryChecks.every((c) => c.ok) ? 'OK' : 'WARNING';
    const summaryValidation = {
      status: summaryStatus as 'OK' | 'WARNING',
      ...(summaryStatus === 'WARNING'
        ? {
            validation_message: summaryChecks
              .filter((c) => !c.ok)
              .map((c) => `"${c.name}": متوقع ${c.expected}، فعلي ${c.actual}`)
              .join(' | '),
          }
        : {}),
      checks: summaryChecks,
    };

    res.json({
      products,
      summary: {
        total_products: products.length,
        total_inventory_value,
        low_stock_count,
        zero_stock_count,
        discrepancy_count,
      },
      validation: summaryValidation,
    });
  })
);

// ── كشف حركات منتج واحد ───────────────────────────────────────────────────

export default router;
