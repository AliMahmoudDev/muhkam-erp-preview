/** inventory/analytics.ts */
import { Router, type IRouter } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '@workspace/db';
import { wrap } from '../../lib/async-handler';
import { hasPermission } from '../../lib/permissions';
import { getTenant } from '../../middleware/auth';

const router: IRouter = Router();

router.get(
  '/inventory/reorder-suggestions',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_view_inventory')) {
      res.status(403).json({ error: 'ليس لديك صلاحية عرض المخزون' });
      return;
    }
    const companyId = getTenant(req);

    const clamp = (v: unknown, min: number, max: number, def: number) => {
      const n = Number(v);
      if (!Number.isFinite(n)) return def;
      return Math.max(min, Math.min(max, Math.floor(n)));
    };
    const days = clamp(req.query.days, 1, 180, 30);
    const coverDays = clamp(req.query.cover, 1, 180, 30);
    const horizonDays = clamp(req.query.horizon, 1, 60, 14);

    const rows = await db.execute(sql`
    WITH tenant_products AS (
      SELECT id, name, sku, category, cost_price, low_stock_threshold
      FROM products
      WHERE company_id = ${companyId} AND is_active = true
    ),
    sales AS (
      SELECT
        sm.product_id,
        SUM(ABS(CAST(sm.quantity AS FLOAT8))) AS sold_qty
      FROM stock_movements sm
      JOIN tenant_products tp ON tp.id = sm.product_id
      WHERE sm.movement_type = 'sale'
        AND sm.created_at >= NOW() - (${days}::int || ' days')::interval
      GROUP BY sm.product_id
    ),
    stock AS (
      SELECT
        sm.product_id,
        SUM(CAST(sm.quantity AS FLOAT8)) AS current_qty
      FROM stock_movements sm
      JOIN tenant_products tp ON tp.id = sm.product_id
      GROUP BY sm.product_id
    )
    SELECT
      p.id                          AS product_id,
      p.name                        AS product_name,
      p.sku,
      p.category,
      CAST(p.cost_price AS FLOAT8)  AS cost_price,
      p.low_stock_threshold         AS min_stock,
      COALESCE(st.current_qty, 0)   AS current_qty,
      COALESCE(s.sold_qty, 0)       AS sold_qty
    FROM tenant_products p
    LEFT JOIN sales s ON s.product_id = p.id
    LEFT JOIN stock st ON st.product_id = p.id
    ORDER BY p.name
  `);

    const suggestions = (rows.rows as Record<string, unknown>[])
      .map((r) => {
        const sold = Number(r.sold_qty ?? 0);
        const current = Number(r.current_qty ?? 0);
        const minStock =
          r.min_stock !== null && r.min_stock !== undefined ? Number(r.min_stock) : null;
        const dailyVelocity = sold / days;
        const coverageDays = dailyVelocity > 0 ? current / dailyVelocity : null;
        const targetByVelocity = Math.ceil(dailyVelocity * coverDays);
        const lowFlag = minStock !== null && current <= minStock;
        const trendingOut = coverageDays !== null && coverageDays <= horizonDays;
        // For low-stock items with no velocity, suggest restoring to 2x min_stock
        const targetByMin =
          lowFlag && minStock !== null ? Math.max(minStock * 2 - current, minStock - current) : 0;
        const suggestedQty = Math.max(targetByVelocity - current, targetByMin, 0);
        const cost = Number(r.cost_price ?? 0);
        const reason =
          lowFlag && trendingOut
            ? 'تحت الحد الأدنى + استهلاك مرتفع'
            : lowFlag
              ? 'تحت الحد الأدنى'
              : trendingOut
                ? `سينفد خلال ${Math.round(coverageDays ?? 0)} يوم`
                : null;
        return {
          product_id: Number(r.product_id),
          product_name: String(r.product_name),
          sku: r.sku ? String(r.sku) : null,
          category: r.category ? String(r.category) : null,
          cost_price: cost,
          min_stock: minStock,
          current_qty: current,
          sold_qty_30d: sold,
          daily_velocity: dailyVelocity,
          coverage_days: coverageDays,
          suggested_qty: suggestedQty,
          suggested_cost: suggestedQty * cost,
          reason,
          priority:
            lowFlag && current <= 0
              ? 'critical'
              : lowFlag
                ? 'high'
                : trendingOut
                  ? 'medium'
                  : 'low',
        };
      })
      .filter((s) => s.reason !== null && s.suggested_qty > 0)
      .sort((a, b) => {
        const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        const d = (order[a.priority] ?? 9) - (order[b.priority] ?? 9);
        if (d !== 0) return d;
        return b.suggested_cost - a.suggested_cost;
      });

    res.json({
      suggestions,
      total_cost: suggestions.reduce((a, s) => a + s.suggested_cost, 0),
      days_analyzed: days,
      cover_days: coverDays,
      horizon_days: horizonDays,
    });
  })
);

/**
 * GET /api/inventory/movements-chart
 * Daily movement aggregates for the last N days (default 30).
 * Returns [{ day, in_qty, out_qty, net }]
 */
router.get(
  '/inventory/movements-chart',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_view_inventory')) {
      res.status(403).json({ error: 'ليس لديك صلاحية' });
      return;
    }
    const companyId = getTenant(req);

    const days = Math.max(7, Math.min(90, Number(req.query.days) || 30));
    const warehouseId = req.query.warehouse_id ? Number(req.query.warehouse_id) : null;

    const rows = await db.execute(sql`
    SELECT
      COALESCE(date, DATE(created_at AT TIME ZONE 'UTC')::text) AS day,
      ROUND(SUM(CASE WHEN CAST(quantity AS FLOAT8) > 0 THEN CAST(quantity AS FLOAT8) ELSE 0 END)::numeric, 2) AS in_qty,
      ROUND(SUM(CASE WHEN CAST(quantity AS FLOAT8) < 0 THEN ABS(CAST(quantity AS FLOAT8)) ELSE 0 END)::numeric, 2) AS out_qty,
      COUNT(*) AS moves
    FROM stock_movements
    WHERE company_id = ${companyId}
      AND created_at >= NOW() - (${days} || ' days')::interval
      ${warehouseId ? sql`AND warehouse_id = ${warehouseId}` : sql``}
    GROUP BY 1
    ORDER BY 1 ASC
  `);

    const result = (
      rows.rows as { day: string; in_qty: string; out_qty: string; moves: string }[]
    ).map((r) => ({
      day: String(r.day),
      in_qty: Number(r.in_qty),
      out_qty: Number(r.out_qty),
      net: Number(r.in_qty) - Number(r.out_qty),
      moves: Number(r.moves),
    }));

    res.json(result);
  })
);



export default router;
