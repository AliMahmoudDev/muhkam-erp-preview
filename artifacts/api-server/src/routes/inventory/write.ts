/** inventory/write.ts */
import { Router, type IRouter } from 'express';
import { eq, and } from 'drizzle-orm';
import { db, stockMovementsTable, productsTable } from '@workspace/db';
import { wrap } from '../../lib/async-handler';
import { hasPermission } from '../../lib/permissions';
import { getTenant } from '../../middleware/auth';
import { writeAuditLog } from '../../lib/audit-log';
import { resolveTenantWarehouseId } from '../../lib/warehouse-guard';
import { inventoryAdjustmentSchema, fmtMovement } from './_helpers';

const router: IRouter = Router();

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

export default router;
