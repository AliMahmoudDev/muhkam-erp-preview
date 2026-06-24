/** inventory/summary.ts */
import { Router, type IRouter } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '@workspace/db';
import { wrap } from '../../lib/async-handler';
import { hasPermission } from '../../lib/permissions';

const router: IRouter = Router();

router.get(
  '/inventory/warehouse-summary',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_view_inventory')) {
      res.status(403).json({ error: 'ليس لديك صلاحية عرض المخزون' });
      return;
    }

    const rows = await db.execute(sql`
    SELECT
      w.id   AS warehouse_id,
      w.name AS warehouse_name,
      COALESCE(
        (SELECT COUNT(DISTINCT pp.product_id)::int
         FROM (
           SELECT product_id, SUM(CAST(quantity AS FLOAT8)) AS wh_qty
           FROM stock_movements sm2 WHERE sm2.warehouse_id = w.id
           GROUP BY product_id
         ) pp WHERE pp.wh_qty > 0
        ), 0)::int AS item_count,
      COALESCE(
        (SELECT SUM(pp.wh_qty * CAST(p.cost_price AS FLOAT8))
         FROM (
           SELECT product_id, SUM(CAST(quantity AS FLOAT8)) AS wh_qty
           FROM stock_movements sm3 WHERE sm3.warehouse_id = w.id
           GROUP BY product_id
         ) pp
         JOIN products p ON p.id = pp.product_id
         WHERE pp.wh_qty > 0
        ), 0) AS total_value
    FROM warehouses w
    ORDER BY w.id
  `);

    const data = (rows.rows as Record<string, unknown>[]).map((r) => ({
      warehouse_id: Number(r.warehouse_id),
      warehouse_name: String(r.warehouse_name),
      item_count: Number(r.item_count ?? 0),
      total_value: Math.round(Number(r.total_value ?? 0) * 100) / 100,
    }));

    const grand_total = Math.round(data.reduce((s, r) => s + r.total_value, 0) * 100) / 100;

    res.json({
      warehouses: data.map((r) => ({
        ...r,
        pct_of_total: grand_total > 0 ? Math.round((r.total_value / grand_total) * 1000) / 10 : 0,
      })),
      grand_total,
    });
  })
);

/**
 * GET /api/inventory/low-stock
 * Per-warehouse low stock alerts: products where calculated_qty <= low_stock_threshold
 * Includes cross-warehouse availability for transfer suggestions.
 */
router.get(
  '/inventory/low-stock',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_view_inventory')) {
      res.status(403).json({ error: 'ليس لديك صلاحية عرض المخزون' });
      return;
    }

    /* ── 1. Fetch all (product, warehouse) pairs with per-warehouse qty ─────── */
    const lowRows = await db.execute(sql`
    SELECT
      p.id                          AS product_id,
      p.name                        AS product_name,
      p.sku,
      p.category,
      CAST(p.cost_price AS FLOAT8)  AS cost_price,
      p.low_stock_threshold         AS min_stock,
      w.id                          AS warehouse_id,
      w.name                        AS warehouse_name,
      COALESCE(SUM(CAST(sm.quantity AS FLOAT8)), 0) AS current_qty
    FROM products p
    JOIN (
      SELECT DISTINCT product_id, warehouse_id FROM stock_movements
    ) pair ON pair.product_id = p.id
    JOIN warehouses w ON w.id = pair.warehouse_id
    LEFT JOIN stock_movements sm
      ON sm.product_id = p.id AND sm.warehouse_id = w.id
    WHERE p.low_stock_threshold IS NOT NULL
    GROUP BY p.id, p.name, p.sku, p.category, p.cost_price, p.low_stock_threshold, w.id, w.name
    HAVING COALESCE(SUM(CAST(sm.quantity AS FLOAT8)), 0) <= p.low_stock_threshold
    ORDER BY w.name, p.name
  `);

    const lowItems = (lowRows.rows as Record<string, unknown>[]).map((r) => ({
      product_id: Number(r.product_id),
      product_name: String(r.product_name),
      sku: r.sku ? String(r.sku) : null,
      category: r.category ? String(r.category) : null,
      cost_price: Number(r.cost_price ?? 0),
      min_stock: Number(r.min_stock),
      warehouse_id: Number(r.warehouse_id),
      warehouse_name: String(r.warehouse_name),
      current_qty: Number(r.current_qty),
    }));

    if (lowItems.length === 0) {
      res.json({ items: [], zero_count: 0, low_count: 0 });
      return;
    }

    /* ── 2. Fetch all warehouse stock for the affected products ─────────────── */
    const productIds = [...new Set(lowItems.map((r) => Number(r.product_id)))].filter(
      Number.isInteger
    );
    if (productIds.length === 0) {
      res.json({ items: [], zero_count: 0, low_count: 0 });
      return;
    }
    const idsCsv = productIds.join(',');

    const whRows = await db.execute(sql`
    SELECT
      sm.product_id::int            AS product_id,
      sm.warehouse_id::int          AS warehouse_id,
      w.name                        AS warehouse_name,
      SUM(CAST(sm.quantity AS FLOAT8)) AS wh_qty
    FROM stock_movements sm
    JOIN warehouses w ON w.id = sm.warehouse_id
    WHERE sm.product_id IN (${sql.raw(idsCsv)})
    GROUP BY sm.product_id, sm.warehouse_id, w.name
    HAVING SUM(CAST(sm.quantity AS FLOAT8)) > 0
  `);

    /* Map product_id → [{warehouse_id, warehouse_name, qty}] */
    const byProduct = new Map<
      number,
      { warehouse_id: number; warehouse_name: string; qty: number }[]
    >();
    for (const r of whRows.rows as Record<string, unknown>[]) {
      const pid = Number(r.product_id);
      if (!byProduct.has(pid)) byProduct.set(pid, []);
      byProduct.get(pid)!.push({
        warehouse_id: Number(r.warehouse_id),
        warehouse_name: String(r.warehouse_name),
        qty: Number(r.wh_qty),
      });
    }

    /* ── 3. Enrich with shortage, suggested qty, cross-warehouse ──────────── */
    const enriched = lowItems.map((item) => {
      const shortage = Math.max(item.min_stock - item.current_qty, 0);
      const suggested_qty = Math.max(item.min_stock * 2 - item.current_qty, 1);
      const all = byProduct.get(item.product_id) ?? [];
      const available_elsewhere = all
        .filter((w) => w.warehouse_id !== item.warehouse_id && w.qty > item.min_stock)
        .sort((a, b) => b.qty - a.qty);

      return {
        ...item,
        shortage,
        suggested_qty,
        available_elsewhere,
        is_zero: item.current_qty <= 0,
      };
    });

    const zero_count = enriched.filter((r) => r.is_zero).length;
    const low_count = enriched.filter((r) => !r.is_zero).length;

    res.json({ items: enriched, zero_count, low_count });
  })
);

/**
 * GET /api/inventory/reorder-suggestions
 * Suggests reorder quantities based on 30-day average daily sales velocity.
 * Returns products where projected coverage (current_qty / daily_velocity) <= 14 days,
 * or current_qty is at/below low_stock_threshold.
 */

export default router;
