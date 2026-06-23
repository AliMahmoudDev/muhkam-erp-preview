/** inventory-control/count_sessions.ts */
import { Router, type IRouter } from 'express';
import { eq, and, inArray, sql } from 'drizzle-orm';;
import { db, productsTable, stockMovementsTable, stockCountSessionsTable, stockCountItemsTable } from '@workspace/db';
import { firstZodError } from '../lib/schemas';
import { resolveTenantWarehouseId } from '../lib/warehouse-guard';
import { wrap } from '../lib/async-handler';
import { hasPermission } from '../lib/permissions';
import { writeAuditLog } from '../lib/audit-log';
import { getTenant } from '../middleware/auth';
import { createCountSessionSchema } from './_helpers';

const router: IRouter = Router();

router.post(
  '/inventory/count-sessions',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_adjust_inventory')) {
      res.status(403).json({ error: 'ليس لديك صلاحية إجراء جرد المخزون' });
      return;
    }

    const parsedSession = createCountSessionSchema.safeParse(req.body);
    if (!parsedSession.success) {
      res.status(400).json({ error: firstZodError(parsedSession.error) });
      return;
    }

    const { warehouse_id, notes, items } = parsedSession.data;

    const companyId = getTenant(req);
    const tenantWarehouseId = await resolveTenantWarehouseId(warehouse_id ?? null, companyId);

    const productIds = items.map((i) => i.product_id);
    const products = await db
      .select()
      .from(productsTable)
      .where(and(inArray(productsTable.id, productIds), eq(productsTable.company_id, companyId)));
    const productMap = new Map(products.map((p) => [p.id, p]));

    const missing = productIds.filter((id) => !productMap.has(id));
    if (missing.length > 0) {
      res.status(400).json({ error: `منتجات غير موجودة: ${missing.join(', ')}` });
      return;
    }

    // احسب المخزون الفعلي لكل منتج في المخزن المحدد من حركات المخزون
    const safeProductIdsCsv = productIds.map(Number).filter(Number.isInteger).join(',');
    const whStockRows = safeProductIdsCsv
      ? await db.execute(sql`
    SELECT product_id::int, COALESCE(SUM(CAST(quantity AS FLOAT8)), 0) AS wh_qty
    FROM stock_movements
    WHERE warehouse_id = ${tenantWarehouseId}
      AND company_id = ${companyId}
      AND product_id IN (${sql.raw(safeProductIdsCsv)})
    GROUP BY product_id
  `)
      : { rows: [] as Record<string, unknown>[] };
    const whStockMap = new Map(
      (whStockRows.rows as Array<{ product_id: number; wh_qty: number }>).map((r) => [
        Number(r.product_id),
        Number(r.wh_qty ?? 0),
      ])
    );

    const session = await db.transaction(async (tx) => {
      const [sess] = await tx
        .insert(stockCountSessionsTable)
        .values({
          warehouse_id: tenantWarehouseId,
          status: 'draft',
          notes: notes ?? null,
          company_id: companyId,
          created_by: req.user?.id ?? null,
        })
        .returning();

      const countItems = items.map((item) => ({
        session_id: sess.id,
        product_id: item.product_id,
        system_qty: String(whStockMap.get(item.product_id) ?? 0),
        physical_qty: String(item.physical_qty),
        notes: item.notes ?? null,
      }));

      const inserted = await tx.insert(stockCountItemsTable).values(countItems).returning();
      return { session: sess, items: inserted };
    });

    res.status(201).json({
      success: true,
      session_id: session.session.id,
      status: session.session.status,
      items_count: session.items.length,
      items: session.items.map((i) => ({
        ...i,
        system_qty: Number(i.system_qty),
        physical_qty: Number(i.physical_qty),
        difference: Number(i.physical_qty) - Number(i.system_qty),
      })),
    });
  })
);

/**
 * GET /api/inventory/count-sessions
 * قائمة جلسات الجرد لهذه الشركة
 */
router.get(
  '/inventory/count-sessions',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_view_inventory')) {
      res.status(403).json({ error: 'ليس لديك صلاحية عرض الجرد' });
      return;
    }

    const sessions = await db
      .select()
      .from(stockCountSessionsTable)
      .where(eq(stockCountSessionsTable.company_id, getTenant(req)))
      .orderBy(stockCountSessionsTable.created_at);

    res.json(
      sessions.map((s) => ({
        ...s,
        applied_at: s.applied_at?.toISOString() ?? null,
        created_at: s.created_at.toISOString(),
      }))
    );
  })
);

/**
 * GET /api/inventory/count-sessions/:id
 * تفاصيل جلسة جرد واحدة مع بنودها
 */
router.get(
  '/inventory/count-sessions/:id',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_view_inventory')) {
      res.status(403).json({ error: 'ليس لديك صلاحية عرض الجرد' });
      return;
    }

    const sessionId = parseInt(String(req.params.id));
    const companyId = getTenant(req);
    const [session] = await db
      .select()
      .from(stockCountSessionsTable)
      .where(
        and(
          eq(stockCountSessionsTable.id, sessionId),
          eq(stockCountSessionsTable.company_id, companyId)
        )
      );

    if (!session) {
      res.status(404).json({ error: 'جلسة الجرد غير موجودة' });
      return;
    }

    const items = await db
      .select({
        id: stockCountItemsTable.id,
        session_id: stockCountItemsTable.session_id,
        product_id: stockCountItemsTable.product_id,
        product_name: productsTable.name,
        product_sku: productsTable.sku,
        system_qty: stockCountItemsTable.system_qty,
        physical_qty: stockCountItemsTable.physical_qty,
        notes: stockCountItemsTable.notes,
      })
      .from(stockCountItemsTable)
      .innerJoin(
        productsTable,
        and(
          eq(stockCountItemsTable.product_id, productsTable.id),
          eq(productsTable.company_id, companyId)
        )
      )
      .where(eq(stockCountItemsTable.session_id, sessionId));

    res.json({
      session: {
        ...session,
        applied_at: session.applied_at?.toISOString() ?? null,
        created_at: session.created_at.toISOString(),
      },
      items: items.map((i) => ({
        ...i,
        system_qty: Number(i.system_qty),
        physical_qty: Number(i.physical_qty),
        difference: Number(i.physical_qty) - Number(i.system_qty),
      })),
    });
  })
);

/**
 * POST /api/inventory/count-sessions/:id/apply
 * يطبّق الجرد:
 *   - لكل منتج يختلف فيه physical_qty عن system_qty يُنشئ stock_movement (adjustment)
 *   - يُحدِّث products.quantity
 *   - يغيّر حالة الجلسة إلى applied
 *   - يُسجِّل في audit_logs
 */
router.post(
  '/inventory/count-sessions/:id/apply',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_adjust_inventory')) {
      res.status(403).json({ error: 'ليس لديك صلاحية تطبيق الجرد' });
      return;
    }

    const sessionId = parseInt(String(req.params.id));
    const companyId = getTenant(req);
    const [session] = await db
      .select()
      .from(stockCountSessionsTable)
      .where(
        and(
          eq(stockCountSessionsTable.id, sessionId),
          eq(stockCountSessionsTable.company_id, companyId)
        )
      );

    if (!session) {
      res.status(404).json({ error: 'جلسة الجرد غير موجودة' });
      return;
    }
    if (session.status === 'applied') {
      res.status(409).json({ error: 'تم تطبيق هذه الجلسة بالفعل' });
      return;
    }

    const items = await db
      .select({
        id: stockCountItemsTable.id,
        product_id: stockCountItemsTable.product_id,
        system_qty: stockCountItemsTable.system_qty,
        physical_qty: stockCountItemsTable.physical_qty,
        notes: stockCountItemsTable.notes,
      })
      .from(stockCountItemsTable)
      .where(eq(stockCountItemsTable.session_id, sessionId));

    if (items.length === 0) {
      res.status(400).json({ error: 'الجلسة لا تحتوي على بنود' });
      return;
    }

    const productIds = items.map((i) => i.product_id);
    const products = await db
      .select()
      .from(productsTable)
      .where(and(inArray(productsTable.id, productIds), eq(productsTable.company_id, companyId)));
    const productMap = new Map(products.map((p) => [p.id, p]));
    const missingProd = productIds.filter((pid) => !productMap.has(pid));
    if (missingProd.length > 0) {
      res.status(400).json({ error: `منتجات غير تابعة لشركتك: ${missingProd.join(', ')}` });
      return;
    }

    const adjustments: Array<{ product_id: number; diff: number; oldQty: number; newQty: number }> =
      [];

    await db.transaction(async (tx) => {
      for (const item of items) {
        const sysQty = Number(item.system_qty);
        const physQty = Number(item.physical_qty);
        const diff = physQty - sysQty;

        if (Math.abs(diff) < 0.001) continue; // لا فرق — تجاوز

        const product = productMap.get(item.product_id)!;
        const oldQty = Number(product.quantity);
        const newQty = oldQty + diff; // قد يختلف عن sysQty إذا وجدت حركات بعد بدء الجرد

        // تحديث كمية المنتج
        await tx
          .update(productsTable)
          .set({ quantity: String(newQty) })
          .where(
            and(eq(productsTable.id, item.product_id), eq(productsTable.company_id, companyId))
          );

        // تسجيل حركة المخزون
        const refNo = `CNT-${session.id}-${item.product_id}`;
        await tx.insert(stockMovementsTable).values({
          product_id: item.product_id,
          product_name: product.name,
          movement_type: 'adjustment',
          quantity: String(diff),
          quantity_before: String(oldQty),
          quantity_after: String(newQty),
          unit_cost: product.cost_price,
          reference_type: 'stock_count',
          reference_id: session.id,
          reference_no: refNo,
          notes: item.notes ?? `جرد مخزون — جلسة #${session.id}`,
          date: new Date().toISOString().split('T')[0],
          warehouse_id: session.warehouse_id,
          company_id: session.company_id,
        });

        adjustments.push({ product_id: item.product_id, diff, oldQty, newQty });
      }

      // تحديث حالة الجلسة
      await tx
        .update(stockCountSessionsTable)
        .set({ status: 'applied', applied_at: new Date() })
        .where(
          and(
            eq(stockCountSessionsTable.id, sessionId),
            eq(stockCountSessionsTable.company_id, companyId)
          )
        );
    });

    // سجل audit
    void writeAuditLog({
      action: 'INVENTORY_COUNT_APPLIED',
      record_type: 'product',
      record_id: sessionId,
      old_value: { session_id: sessionId, warehouse_id: session.warehouse_id, status: 'draft' },
      new_value: {
        status: 'applied',
        adjustments_count: adjustments.length,
        adjustments: adjustments.slice(0, 20), // أقصى 20 لتجنب overflow
      },
      user: { id: req.user?.id, username: req.user?.username },
    });

    res.json({
      success: true,
      session_id: sessionId,
      adjustments_applied: adjustments.length,
      adjustments,
    });
  })
);

/* ═══════════════════════════════════════════════════════════════════════════
 * SECTION B — تحويل المخزون بين المخازن (Stock Transfer)
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * POST /api/inventory/transfers
 * ينفّذ تحويل مخزون من مخزن إلى آخر في transaction واحدة
 *
 * Body: {
 *   from_warehouse_id, to_warehouse_id,
 *   notes?,
 *   items: [{ product_id, quantity }]
 * }

export default router;
