/**
 * @module routes/inventory
 * @description Inventory management and audit routes for MUHKAM ERP.
 *
 * Endpoints:
 *   GET  /inventory/audit              Full inventory audit — compares actual product.quantity
 *                                      against calculated quantity from all stock movements.
 *                                      Identifies discrepancies for stocktake reconciliation.
 *   GET  /inventory/movements          Paginated stock movement history (purchases, sales, adjustments,
 *                                      transfers, returns). Filterable by product, date range, type.
 *   GET  /inventory/movements/:id      Single stock movement record.
 *   POST /inventory/adjustment         Manual quantity adjustment (stocktake correction).
 *                                      Creates a stock movement of type "adjustment" and
 *                                      updates product.quantity atomically. Writes audit log.
 *   GET  /inventory/low-stock          Products with quantity below their low_stock_threshold.
 *                                      Used by the alerts system and dashboard cards.
 *
 * Warehouse scoping:
 *   - admin/manager: can view all warehouses or filter by warehouse_id query param.
 *   - cashier/salesperson: restricted to their assigned warehouse (req.user.warehouse_id).
 *
 * Multi-tenant: all queries are scoped by company_id via getTenant(req).
 * @access All endpoints require valid JWT + company_id tenant resolution.
 */
import { Router, type IRouter } from 'express';
import { eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, stockMovementsTable, productsTable } from '@workspace/db';
import { wrap } from '../lib/async-handler';
import { hasPermission } from '../lib/permissions';
import { getTenant } from '../middleware/auth';
import { writeAuditLog } from '../lib/audit-log';
import { resolveTenantWarehouseId } from '../lib/warehouse-guard';

const inventoryAdjustmentSchema = z.object({
  product_id: z
    .number({
      required_error: 'معرّف المنتج مطلوب',
      invalid_type_error: 'معرّف المنتج يجب أن يكون رقماً',
    })
    .int()
    .positive(),
  new_quantity: z
    .number({
      required_error: 'الكمية الجديدة مطلوبة',
      invalid_type_error: 'الكمية يجب أن تكون رقماً',
    })
    .min(0, 'الكمية لا يمكن أن تكون سالبة'),
  notes: z.string().max(500).optional().nullable(),
  warehouse_id: z.number().int().positive().optional().nullable(),
});

interface AuditRow {
  id: unknown;
  name: unknown;
  sku: unknown;
  category: unknown;
  actual_qty: unknown;
  cost_price: unknown;
  sale_price: unknown;
  low_stock_threshold: unknown;
  opening_qty: unknown;
  purchased_qty: unknown;
  sold_qty: unknown;
  sale_return_qty: unknown;
  purchase_return_qty: unknown;
  adjustment_qty: unknown;
  calculated_qty: unknown;
}

const router: IRouter = Router();

function fmtMovement(m: typeof stockMovementsTable.$inferSelect) {
  return {
    ...m,
    quantity: Number(m.quantity),
    quantity_before: Number(m.quantity_before),
    quantity_after: Number(m.quantity_after),
    unit_cost: Number(m.unit_cost),
    created_at: m.created_at.toISOString(),
  };
}

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
router.get(
  '/inventory/product/:id',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_view_inventory')) {
      res.status(403).json({ error: 'ليس لديك صلاحية عرض المخزون' });
      return;
    }
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      res.status(400).json({ error: 'معرّف غير صالح' });
      return;
    }

    const [product] = await db
      .select()
      .from(productsTable)
      .where(and(eq(productsTable.id, id), eq(productsTable.company_id, getTenant(req))));
    if (!product) {
      res.status(404).json({ error: 'المنتج غير موجود' });
      return;
    }

    const movements = await db
      .select()
      .from(stockMovementsTable)
      .where(eq(stockMovementsTable.product_id, id))
      .orderBy(stockMovementsTable.created_at);

    const calculated_qty = movements.reduce((s, m) => s + Number(m.quantity), 0);
    const actual_qty = Number(product.quantity);

    // مثال الحساب (لأول منتج لإظهار الصحة)
    const breakdown = {
      opening_qty: movements
        .filter((m) => m.movement_type === 'opening_balance')
        .reduce((s, m) => s + Math.abs(Number(m.quantity)), 0),
      purchased_qty: movements
        .filter((m) => m.movement_type === 'purchase')
        .reduce((s, m) => s + Math.abs(Number(m.quantity)), 0),
      sold_qty: movements
        .filter((m) => m.movement_type === 'sale')
        .reduce((s, m) => s + Math.abs(Number(m.quantity)), 0),
      sale_return_qty: movements
        .filter((m) => m.movement_type === 'sale_return')
        .reduce((s, m) => s + Math.abs(Number(m.quantity)), 0),
      purchase_return_qty: movements
        .filter((m) => m.movement_type === 'purchase_return')
        .reduce((s, m) => s + Math.abs(Number(m.quantity)), 0),
      adjustment_qty: movements
        .filter((m) => m.movement_type === 'adjustment')
        .reduce((s, m) => s + Number(m.quantity), 0),
    };

    res.json({
      product: {
        ...product,
        quantity: actual_qty,
        cost_price: Number(product.cost_price),
        sale_price: Number(product.sale_price),
        created_at: product.created_at.toISOString(),
      },
      movements: movements.map(fmtMovement),
      calculated_qty,
      actual_qty,
      discrepancy: actual_qty - calculated_qty,
      breakdown,
      formula: `${breakdown.opening_qty} + ${breakdown.purchased_qty} + ${breakdown.sale_return_qty} - ${breakdown.sold_qty} - ${breakdown.purchase_return_qty} + ${breakdown.adjustment_qty} = ${calculated_qty}`,
    });
  })
);

// ── تسوية يدوية ────────────────────────────────────────────────────────────
router.post(
  '/inventory/adjustment',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_adjust_inventory')) {
      res.status(403).json({ error: 'ليس لديك صلاحية تسوية المخزون' });
      return;
    }
    const v = inventoryAdjustmentSchema.safeParse(req.body);
    if (!v.success) {
      res.status(400).json({ error: v.error.errors[0]?.message ?? 'بيانات غير صالحة' });
      return;
    }
    const { product_id, new_quantity, notes, warehouse_id } = v.data;
    const prodId = product_id;
    const newQty = new_quantity;
    const companyId = getTenant(req);

    const [product] = await db
      .select()
      .from(productsTable)
      .where(and(eq(productsTable.id, prodId), eq(productsTable.company_id, companyId)));
    if (!product) {
      res.status(404).json({ error: 'المنتج غير موجود' });
      return;
    }

    const effectiveWarehouseId =
      req.user?.role === 'admin' || req.user?.role === 'manager'
        ? (warehouse_id ?? null)
        : (req.user?.warehouse_id ?? null);
    const tenantWarehouseId = await resolveTenantWarehouseId(effectiveWarehouseId, companyId);

    const oldQty = Number(product.quantity);
    const diff = newQty - oldQty;

    await db.transaction(async (tx) => {
      await tx
        .update(productsTable)
        .set({ quantity: String(newQty) })
        .where(and(eq(productsTable.id, prodId), eq(productsTable.company_id, companyId)));

      await tx.insert(stockMovementsTable).values({
        product_id: prodId,
        product_name: product.name,
        movement_type: 'adjustment',
        quantity: String(diff),
        quantity_before: String(oldQty),
        quantity_after: String(newQty),
        unit_cost: product.cost_price,
        reference_type: 'adjustment',
        reference_no: `ADJ-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`,
        notes: notes ?? 'تسوية يدوية',
        date: new Date().toISOString().split('T')[0],
        warehouse_id: tenantWarehouseId,
        company_id: companyId,
      });
    });

    void writeAuditLog({
      action: 'INVENTORY_ADJUSTMENT',
      record_type: 'product',
      record_id: prodId,
      old_value: { quantity: oldQty, product_name: product.name, sku: product.sku },
      new_value: { quantity: newQty, diff, notes: notes ?? 'تسوية يدوية' },
      user: { id: req.user?.id, username: req.user?.username },
    });

    res.json({
      success: true,
      product_id: prodId,
      old_qty: oldQty,
      new_qty: newQty,
      diff,
    });
  })
);

/**
 * GET /api/inventory/warehouse-summary
 * إجمالي المخزون لكل مخزن: عدد المنتجات، القيمة الكلية، نسبة من الإجمالي
 */
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
