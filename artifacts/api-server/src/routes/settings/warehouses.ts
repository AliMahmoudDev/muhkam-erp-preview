import { Router } from 'express';
import { eq, count, and } from 'drizzle-orm';
import { db } from '@workspace/db';
import { authenticate, requireRole, requireTenantStrict, getTenant } from '../../middleware/auth';
import { z } from 'zod/v4';
import { firstZodError } from '../../lib/schemas';
import { wrap } from '../../lib/async-handler';
import { warehousesTable, stockMovementsTable, stockCountSessionsTable } from '@workspace/db';

const createWarehouseSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional().nullable(),
  branch_id: z.union([z.string(), z.number()]).optional().nullable(),
});

const updateWarehouseSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional().nullable(),
  branch_id: z.union([z.string(), z.number()]).optional().nullable(),
});

const router = Router();

// ─── WAREHOUSES ───────────────────────────────────────────────────────────────

router.get(
  '/settings/warehouses',
  wrap(async (req, res) => {
    const companyId = getTenant(req);
    const warehouses = await db
      .select()
      .from(warehousesTable)
      .where(eq(warehousesTable.company_id, companyId))
      .orderBy(warehousesTable.id);
    res.json(warehouses);
  })
);

router.post(
  '/settings/warehouses',
  authenticate,
  requireRole('admin'),
  wrap(async (req, res) => {
    const parsedWH = createWarehouseSchema.safeParse(req.body);
    if (!parsedWH.success) {
      res.status(400).json({ error: firstZodError(parsedWH.error) });
      return;
    }
    const { name, address, branch_id } = parsedWH.data;
    const companyId = getTenant(req);
    const [warehouse] = await db
      .insert(warehousesTable)
      .values({
        name,
        address: address || null,
        company_id: companyId,
        branch_id: branch_id ? Number(branch_id) : null,
      })
      .returning();
    res.json(warehouse);
  })
);

router.put(
  '/settings/warehouses/:id',
  authenticate,
  requireRole('admin'),
  requireTenantStrict,
  wrap(async (req, res) => {
    const parsedWHU = updateWarehouseSchema.safeParse(req.body);
    if (!parsedWHU.success) {
      res.status(400).json({ error: firstZodError(parsedWHU.error) });
      return;
    }
    const id = Number(req.params.id);
    const tenant = getTenant(req);
    const { name, address, branch_id } = parsedWHU.data;
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = String(name).trim();
    if (address !== undefined) updates.address = address ? String(address).trim() : null;
    if (branch_id !== undefined) updates.branch_id = branch_id ? Number(branch_id) : null;
    const [wh] = await db
      .update(warehousesTable)
      .set(updates)
      .where(and(eq(warehousesTable.id, id), eq(warehousesTable.company_id, tenant)))
      .returning();
    if (!wh) {
      res.status(404).json({ error: 'المخزن غير موجود' });
      return;
    }
    res.json(wh);
  })
);

router.delete(
  '/settings/warehouses/:id',
  authenticate,
  requireRole('admin'),
  requireTenantStrict,
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    const tenant = getTenant(req);
    const [wh] = await db
      .select()
      .from(warehousesTable)
      .where(and(eq(warehousesTable.id, id), eq(warehousesTable.company_id, tenant)));
    if (!wh) {
      res.status(404).json({ error: 'المخزن غير موجود' });
      return;
    }

    const [[movements], [sessions]] = await Promise.all([
      db
        .select({ n: count() })
        .from(stockMovementsTable)
        .where(eq(stockMovementsTable.warehouse_id, id)),
      db
        .select({ n: count() })
        .from(stockCountSessionsTable)
        .where(eq(stockCountSessionsTable.warehouse_id, id)),
    ]);

    if (Number(movements.n) > 0) {
      res.status(409).json({ error: 'لا يمكن حذف مخزن له حركات مخزونية مسجّلة' });
      return;
    }
    if (Number(sessions.n) > 0) {
      res.status(409).json({ error: 'لا يمكن حذف مخزن له جلسات جرد مسجّلة' });
      return;
    }

    await db.delete(warehousesTable).where(eq(warehousesTable.id, id));
    res.json({ success: true });
  })
);

export default router;
