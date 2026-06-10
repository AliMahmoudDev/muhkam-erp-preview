import { Router, type IRouter } from 'express';
import { eq, and } from 'drizzle-orm';
import {
  db,
  productsTable,
  stockMovementsTable,
  safesTable,
  transactionsTable,
  customersTable,
} from '@workspace/db';
import { wrap } from '../lib/async-handler';
import { resolveTenantWarehouseId } from '../lib/warehouse-guard';
import { z } from 'zod/v4';
import { getTenant } from '../middleware/auth';
import { writeAuditLog } from '../lib/audit-log';

const router: IRouter = Router();

const OpeningBalanceProductBody = z.object({
  product_id: z.coerce.number().int().positive('معرف المنتج مطلوب'),
  quantity: z.coerce.number().positive('الكمية يجب أن تكون رقماً موجباً'),
  cost_price: z.coerce.number().min(0, 'سعر التكلفة غير صحيح'),
  date: z.string().optional(),
  notes: z.string().optional(),
});

const OpeningBalanceTreasuryBody = z.object({
  safe_id: z.coerce.number().int().positive('معرف الخزينة مطلوب'),
  amount: z.coerce.number().positive('المبلغ يجب أن يكون رقماً موجباً'),
  date: z.string().optional(),
  notes: z.string().optional(),
});

const OpeningBalanceCustomerBody = z.object({
  customer_id: z.coerce.number().int().positive('معرف العميل مطلوب'),
  amount: z.coerce.number().positive('المبلغ يجب أن يكون رقماً موجباً'),
  date: z.string().optional(),
  notes: z.string().optional(),
});

const OpeningBalanceSupplierBody = z
  .object({
    supplier_id: z.coerce.number().int().positive().optional(),
    customer_id: z.coerce.number().int().positive().optional(),
    amount: z.coerce.number().positive('المبلغ يجب أن يكون رقماً موجباً'),
    date: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine((data) => data.supplier_id != null || data.customer_id != null, {
    message: 'المورد مطلوب',
  });

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT OPENING BALANCE
// ─────────────────────────────────────────────────────────────────────────────

router.get(
  '/opening-balance/product',
  wrap(async (req, res) => {
    const companyId: number = getTenant(req);
    const movements = await db
      .select()
      .from(stockMovementsTable)
      .where(
        and(
          eq(stockMovementsTable.movement_type, 'opening_balance'),
          eq(stockMovementsTable.company_id, companyId)
        )
      );
    res.json(
      movements.map((m) => ({
        ...m,
        quantity: Number(m.quantity),
        quantity_before: Number(m.quantity_before),
        quantity_after: Number(m.quantity_after),
        unit_cost: Number(m.unit_cost),
        created_at: m.created_at.toISOString(),
      }))
    );
  })
);

router.post(
  '/inventory/opening-balance',
  wrap(async (req, res) => {
    const parsed = OpeningBalanceProductBody.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({
          error: 'بيانات رصيد أول المدة غير صحيحة',
          details: parsed.error.issues.map((i) => i.message),
        });
      return;
    }

    const { product_id: prodId, quantity: qty, cost_price: cost, date, notes } = parsed.data;

    const role = req.user?.role ?? 'cashier';
    const queryWarehouseId = req.query.warehouse_id
      ? parseInt(String(req.query.warehouse_id), 10)
      : null;
    const effectiveWarehouseId =
      role === 'admin' || role === 'manager' ? queryWarehouseId : (req.user?.warehouse_id ?? null);

    const companyId: number = getTenant(req);

    const tenantWarehouseId = await resolveTenantWarehouseId(effectiveWarehouseId, companyId);

    const [product] = await db
      .select()
      .from(productsTable)
      .where(and(eq(productsTable.id, prodId), eq(productsTable.company_id, companyId)));
    if (!product) {
      res.status(404).json({ error: 'المنتج غير موجود' });
      return;
    }

    // Block if opening balance already registered for this product
    const [existing] = await db
      .select()
      .from(stockMovementsTable)
      .where(
        and(
          eq(stockMovementsTable.product_id, prodId),
          eq(stockMovementsTable.movement_type, 'opening_balance')
        )
      );
    if (existing) {
      res.status(409).json({ error: 'رصيد أول المدة مسجل مسبقاً لهذا المنتج' });
      return;
    }

    const oldQty = Number(product.quantity);
    const oldCost = Number(product.cost_price);
    const newQty = oldQty + qty;
    // Weighted average cost
    const newCost = newQty > 0 ? (oldQty * oldCost + qty * cost) / newQty : cost;

    await db.transaction(async (tx) => {
      await tx
        .update(productsTable)
        .set({
          quantity: String(newQty),
          cost_price: String(Math.round(newCost * 10000) / 10000),
        })
        .where(eq(productsTable.id, prodId));

      await tx.insert(stockMovementsTable).values({
        product_id: prodId,
        product_name: product.name,
        movement_type: 'opening_balance',
        quantity: String(qty),
        quantity_before: String(oldQty),
        quantity_after: String(newQty),
        unit_cost: String(cost),
        reference_type: 'opening_balance',
        reference_no: `OB-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`,
        notes: notes ?? 'رصيد أول المدة',
        date: date ?? new Date().toISOString().split('T')[0],
        warehouse_id: tenantWarehouseId,
        company_id: companyId,
      });
    });

    void writeAuditLog({
      action: 'create',
      record_type: 'opening_balance',
      record_id: prodId,
      new_value: {
        product_id: prodId,
        product_name: product.name,
        quantity: qty,
        cost_price: cost,
      },
      user: req.user,
      company_id: companyId,
    });
    res.status(201).json({
      success: true,
      product_id: prodId,
      product_name: product.name,
      old_qty: oldQty,
      new_qty: newQty,
      old_cost: oldCost,
      new_cost: Math.round(newCost * 10000) / 10000,
    });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// TREASURY (SAFE) OPENING BALANCE
// ─────────────────────────────────────────────────────────────────────────────

router.get(
  '/opening-balance/treasury',
  wrap(async (req, res) => {
    const companyId: number = getTenant(req);
    const txns = await db
      .select()
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.reference_type, 'treasury_opening'),
          eq(transactionsTable.company_id, companyId)
        )
      );
    res.json(
      txns.map((t) => ({
        ...t,
        amount: Number(t.amount),
        created_at: t.created_at.toISOString(),
      }))
    );
  })
);

router.post(
  '/opening-balance/treasury',
  wrap(async (req, res) => {
    const companyId: number = getTenant(req);

    const parsed = OpeningBalanceTreasuryBody.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({
          error: 'بيانات رصيد أول المدة للخزينة غير صحيحة',
          details: parsed.error.issues.map((i) => i.message),
        });
      return;
    }

    const { safe_id, amount: amt, date, notes } = parsed.data;

    const [safe] = await db
      .select()
      .from(safesTable)
      .where(and(eq(safesTable.id, safe_id), eq(safesTable.company_id, companyId)));
    if (!safe) {
      res.status(404).json({ error: 'الخزينة غير موجودة' });
      return;
    }

    await db.transaction(async (tx) => {
      await tx
        .update(safesTable)
        .set({ balance: String(Number(safe.balance) + amt) })
        .where(eq(safesTable.id, safe.id));

      await tx.insert(transactionsTable).values({
        type: 'opening_balance',
        reference_type: 'treasury_opening',
        reference_id: safe.id,
        safe_id: safe.id,
        safe_name: safe.name,
        amount: String(amt),
        direction: 'in',
        description: notes ?? `رصيد أول المدة — ${safe.name}`,
        date: date ?? new Date().toISOString().split('T')[0],
        company_id: companyId,
      });
    });

    void writeAuditLog({
      action: 'create',
      record_type: 'opening_balance',
      record_id: safe.id,
      new_value: { safe_id: safe.id, safe_name: safe.name, amount: amt },
      user: req.user,
      company_id: companyId,
    });
    res.status(201).json({ success: true, safe_id: safe.id, safe_name: safe.name, amount: amt });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER OPENING BALANCE
// ─────────────────────────────────────────────────────────────────────────────

router.get(
  '/opening-balance/customer',
  wrap(async (req, res) => {
    const companyId: number = getTenant(req);
    const txns = await db
      .select()
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.reference_type, 'customer_opening'),
          eq(transactionsTable.company_id, companyId)
        )
      );
    res.json(
      txns.map((t) => ({
        ...t,
        amount: Number(t.amount),
        created_at: t.created_at.toISOString(),
      }))
    );
  })
);

router.post(
  '/opening-balance/customer',
  wrap(async (req, res) => {
    const companyId: number = getTenant(req);

    const parsed = OpeningBalanceCustomerBody.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({
          error: 'بيانات رصيد أول المدة للعميل غير صحيحة',
          details: parsed.error.issues.map((i) => i.message),
        });
      return;
    }

    const { customer_id: custId, amount: amt, date, notes } = parsed.data;

    const [customer] = await db
      .select()
      .from(customersTable)
      .where(and(eq(customersTable.id, custId), eq(customersTable.company_id, companyId)));
    if (!customer) {
      res.status(404).json({ error: 'العميل غير موجود' });

      return;
    }

    if (customer.is_customer === false) {
      res.status(400).json({ error: 'هذا السجل ليس عميلاً' });
      return;
    }

    await db.transaction(async (tx) => {
      await tx
        .update(customersTable)
        .set({ balance: String(Number(customer.balance) + amt) })
        .where(and(eq(customersTable.id, custId), eq(customersTable.company_id, companyId)));

      await tx.insert(transactionsTable).values({
        type: 'opening_balance',
        reference_type: 'customer_opening',
        reference_id: custId,
        customer_id: custId,
        customer_name: customer.name,
        amount: String(amt),
        direction: 'none',
        description: notes ?? `رصيد أول المدة — ${customer.name}`,
        date: date ?? new Date().toISOString().split('T')[0],
        company_id: companyId,
      });
    });

    void writeAuditLog({
      action: 'create',
      record_type: 'opening_balance',
      record_id: custId,
      new_value: { customer_id: custId, customer_name: customer.name, amount: amt },
      user: req.user,
      company_id: companyId,
    });
    res
      .status(201)
      .json({ success: true, customer_id: custId, customer_name: customer.name, amount: amt });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// SUPPLIER OPENING BALANCE (uses customers with is_supplier = true)
// ─────────────────────────────────────────────────────────────────────────────

router.get(
  '/opening-balance/supplier',
  wrap(async (req, res) => {
    const companyId: number = getTenant(req);
    const txns = await db
      .select()
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.reference_type, 'supplier_opening'),
          eq(transactionsTable.company_id, companyId)
        )
      );
    res.json(
      txns.map((t) => ({
        ...t,
        amount: Number(t.amount),
        created_at: t.created_at.toISOString(),
      }))
    );
  })
);

router.post(
  '/opening-balance/supplier',
  wrap(async (req, res) => {
    const companyId: number = getTenant(req);

    const parsed = OpeningBalanceSupplierBody.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({
          error: 'بيانات رصيد أول المدة للمورد غير صحيحة',
          details: parsed.error.issues.map((i) => i.message),
        });
      return;
    }

    const { supplier_id, customer_id: qCustId, amount: amt, date, notes } = parsed.data;
    const custId = supplier_id ?? qCustId;
    if (!custId) {
      res.status(400).json({ error: 'يجب تحديد المورد أو العميل' });
      return;
    }

    const [customer] = await db
      .select()
      .from(customersTable)
      .where(and(eq(customersTable.id, custId), eq(customersTable.company_id, companyId)));
    if (!customer) {
      res.status(404).json({ error: 'المورد غير موجود' });

      return;
    }

    if (customer.is_supplier !== true) {
      res.status(400).json({ error: 'هذا السجل ليس مورداً' });
      return;
    }

    await db.transaction(async (tx) => {
      await tx
        .update(customersTable)
        .set({ balance: String(Number(customer.balance) + amt) })
        .where(and(eq(customersTable.id, custId), eq(customersTable.company_id, companyId)));

      await tx.insert(transactionsTable).values({
        type: 'opening_balance',
        reference_type: 'supplier_opening',
        reference_id: custId,
        customer_id: custId,
        customer_name: customer.name,
        amount: String(amt),
        direction: 'none',
        description: notes ?? `رصيد أول المدة — ${customer.name}`,
        date: date ?? new Date().toISOString().split('T')[0],
        company_id: companyId,
      });
    });

    void writeAuditLog({
      action: 'create',
      record_type: 'opening_balance',
      record_id: custId,
      new_value: { supplier_id: custId, supplier_name: customer.name, amount: amt },
      user: req.user,
      company_id: companyId,
    });
    res
      .status(201)
      .json({ success: true, supplier_id: custId, supplier_name: customer.name, amount: amt });
  })
);

export default router;
