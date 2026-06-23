/** inventory-control/enriched.ts */
import { Router, type IRouter } from 'express';
import { eq, sql } from 'drizzle-orm';;
import { db, stockMovementsTable } from '@workspace/db';
import { wrap } from '../lib/async-handler';
import { hasPermission } from '../lib/permissions';
import { getTenant } from '../middleware/auth';

const router: IRouter = Router();

router.get(
  '/inventory/transfers',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_view_inventory')) {
      res.status(403).json({ error: 'ليس لديك صلاحية عرض التحويلات' });
      return;
    }
    const companyId = getTenant(req);
    const rows = await db
      .select()
      .from(stockMovementsTable)
      .where(eq(stockMovementsTable.company_id, companyId))
      .orderBy(stockMovementsTable.created_at);
    const transfers = rows.filter(
      (r) => r.movement_type === 'transfer_out' || r.movement_type === 'transfer_in'
    );
    res.json(
      transfers.map((t) => ({
        ...t,
        quantity: Number(t.quantity),
        quantity_before: Number(t.quantity_before ?? 0),
        quantity_after: Number(t.quantity_after ?? 0),
        created_at: t.created_at.toISOString(),
      }))
    );
  })
);

/**
 * GET /api/inventory/count-sessions-enriched
 * Same as count-sessions but includes items_count and adjustments_count per session.
 */
router.get(
  '/inventory/count-sessions-enriched',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_view_inventory')) {
      res.status(403).json({ error: 'ليس لديك صلاحية عرض الجرد' });
      return;
    }

    const cidEnriched = getTenant(req);
    const rows = await db.execute(sql`
    SELECT
      s.id,
      s.warehouse_id,
      s.status,
      s.notes,
      s.company_id,
      s.created_by,
      s.created_at,
      s.applied_at,
      COUNT(i.id)::int AS items_count,
      COUNT(
        CASE WHEN ABS(CAST(i.physical_qty AS FLOAT8) - CAST(i.system_qty AS FLOAT8)) > 0.001
             THEN 1 END
      )::int AS adjustments_count
    FROM stock_count_sessions s
    LEFT JOIN stock_count_items i ON i.session_id = s.id
    WHERE s.company_id = ${cidEnriched}
    GROUP BY s.id, s.warehouse_id, s.status, s.notes, s.company_id, s.created_by, s.created_at, s.applied_at
    ORDER BY s.created_at DESC
  `);

    res.json(
      (rows.rows as Record<string, unknown>[]).map((r) => ({
        id: Number(r.id),
        warehouse_id: Number(r.warehouse_id),
        status: String(r.status),
        notes: r.notes ? String(r.notes) : null,
        company_id: Number(r.company_id),
        created_by: r.created_by ? Number(r.created_by) : null,
        created_at: new Date(String(r.created_at)).toISOString(),
        applied_at: r.applied_at ? new Date(String(r.applied_at)).toISOString() : null,
        items_count: Number(r.items_count ?? 0),
        adjustments_count: Number(r.adjustments_count ?? 0),
      }))
    );
  })
);

/**
 * GET /api/inventory/transfers-enriched
 * Same as transfers but includes items_count and total_qty per transfer.
 */
router.get(
  '/inventory/transfers-enriched',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_view_inventory')) {
      res.status(403).json({ error: 'ليس لديك صلاحية عرض التحويلات' });
      return;
    }

    const cidT = getTenant(req);
    const rows = await db.execute(sql`
    SELECT
      t.id,
      t.from_warehouse_id,
      t.to_warehouse_id,
      t.status,
      t.notes,
      t.company_id,
      t.created_by,
      t.created_at,
      COUNT(i.id)::int                            AS items_count,
      COALESCE(SUM(CAST(i.quantity AS FLOAT8)), 0) AS total_qty
    FROM stock_transfers t
    LEFT JOIN stock_transfer_items i ON i.transfer_id = t.id
    WHERE t.company_id = ${cidT}
    GROUP BY t.id, t.from_warehouse_id, t.to_warehouse_id, t.status, t.notes, t.company_id, t.created_by, t.created_at
    ORDER BY t.created_at DESC
  `);

    res.json(
      (rows.rows as Record<string, unknown>[]).map((r) => ({
        id: Number(r.id),
        from_warehouse_id: Number(r.from_warehouse_id),
        to_warehouse_id: Number(r.to_warehouse_id),
        status: String(r.status),
        notes: r.notes ? String(r.notes) : null,
        company_id: Number(r.company_id),
        created_by: r.created_by ? Number(r.created_by) : null,
        created_at: new Date(String(r.created_at)).toISOString(),
        items_count: Number(r.items_count ?? 0),
        total_qty: Math.round(Number(r.total_qty ?? 0) * 1000) / 1000,
      }))
    );
  })
);



export default router;
