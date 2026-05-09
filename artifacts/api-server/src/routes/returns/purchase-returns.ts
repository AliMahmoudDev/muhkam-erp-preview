/**
 * Purchase returns — create, list, get, and cancel purchase return records.
 */
import { Router, type IRouter } from "express";
import { eq, desc, and, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  db, purchaseReturnsTable, purchaseReturnItemsTable,
  productsTable, customersTable, safesTable, transactionsTable, stockMovementsTable,
  purchaseItemsTable, customerLedgerTable, purchasesTable,
} from "@workspace/db";
import { nextPurchaseReturnNo } from "../../lib/invoice-no";
import { wrap, httpError } from "../../lib/async-handler";
import { assertPeriodOpen } from "../../lib/period-lock";
import { writeAuditLog } from "../../lib/audit-log";
import { hasPermission } from "../../lib/permissions";
import { resolveTenantWarehouseId } from "../../lib/warehouse-guard";
import { getTenant } from "../../middleware/auth";

const router: IRouter = Router();

const returnItemSchema = z.object({
  product_id:  z.number().int().positive(),
  quantity:    z.number().positive("الكمية يجب أن تكون أكبر من صفر"),
  unit_price:  z.number().min(0),
  total_price: z.number().min(0),
});

const createPurchaseReturnSchema = z.object({
  items:         z.array(returnItemSchema).min(1, "أضف أصناف المرتجع"),
  purchase_id:   z.number().int().positive().optional().nullable(),
  customer_id:   z.number().int().positive().optional().nullable(),
  customer_name: z.string().max(200).optional().nullable(),
  supplier_name: z.string().max(200).optional().nullable(),
  reason:        z.string().max(500).optional().nullable(),
  notes:         z.string().max(500).optional().nullable(),
  date:          z.string().optional().nullable(),
  refund_type:   z.enum(["cash", "balance_credit"]).optional().default("balance_credit"),
  safe_id:       z.number().int().positive().optional().nullable(),
});

// ══════════════════════════════════════════════════════════════════════════════
// مرتجعات المشتريات
// ══════════════════════════════════════════════════════════════════════════════

router.get("/purchase-returns", wrap(async (req, res) => {
  const companyId = getTenant(req);
  const items = await db
    .select({
      id: purchaseReturnsTable.id,
      return_no: purchaseReturnsTable.return_no,
      purchase_id: purchaseReturnsTable.purchase_id,
      customer_id: purchaseReturnsTable.customer_id,
      customer_name: purchaseReturnsTable.customer_name,
      total_amount: purchaseReturnsTable.total_amount,
      reason: purchaseReturnsTable.reason,
      notes: purchaseReturnsTable.notes,
      date: purchaseReturnsTable.date,
      refund_type: purchaseReturnsTable.refund_type,
      created_at: purchaseReturnsTable.created_at,
      invoice_no: purchasesTable.invoice_no,
    })
    .from(purchaseReturnsTable)
    .leftJoin(purchasesTable, eq(purchaseReturnsTable.purchase_id, purchasesTable.id))
    .where(eq(purchaseReturnsTable.company_id, companyId))
    .orderBy(desc(purchaseReturnsTable.created_at));
  res.json(items.map(r => ({ ...r, total_amount: Number(r.total_amount), created_at: r.created_at?.toISOString() })));
}));

router.get("/purchase-returns/:id", wrap(async (req, res) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: "معرّف غير صالح" }); return; }
  const companyId = getTenant(req);
  const [ret] = await db.select().from(purchaseReturnsTable).where(and(eq(purchaseReturnsTable.id, id), eq(purchaseReturnsTable.company_id, companyId)));
  if (!ret) { res.status(404).json({ error: "غير موجود" }); return; }
  const items = await db.select().from(purchaseReturnItemsTable).where(eq(purchaseReturnItemsTable.return_id, id));
  res.json({
    ...ret,
    total_amount: Number(ret.total_amount),
    created_at: ret.created_at.toISOString(),
    items: items.map(i => ({
      ...i,
      quantity: Number(i.quantity),
      unit_price: Number(i.unit_price),
      total_price: Number(i.total_price),
      unit_cost_at_return: Number(i.unit_cost_at_return),
      total_cost_at_return: Number(i.total_cost_at_return),
    })),
  });
}));

/*
 * POST /purchase-returns
 *
 * كل بند مرتجع يجب أن يحمل (اختياري عند وجود purchase_id):
 *   original_purchase_item_id — معرّف البند الدقيق من purchase_items
 *   product_id / product_name / quantity / unit_price / total_price
 */
router.post("/purchase-returns", wrap(async (req, res) => {
  const vpr = createPurchaseReturnSchema.safeParse(req.body);
  if (!vpr.success) { return res.status(400).json({ error: vpr.error.errors[0]?.message ?? "بيانات غير صالحة" }); }
  const {
    purchase_id, customer_id, customer_name, supplier_name,
    items, reason, notes, date,
    refund_type, safe_id,
  } = req.body;

  const companyId = getTenant(req);

  if (purchase_id) {
    const [origPurch] = await db.select({ id: purchasesTable.id })
      .from(purchasesTable)
      .where(and(eq(purchasesTable.id, parseInt(purchase_id)), eq(purchasesTable.company_id, companyId)));
    if (!origPurch) { res.status(400).json({ error: "فاتورة الشراء الأصلية غير موجودة" }); return; }
  }

  if (customer_id) {
    const [ownC] = await db.select({ id: customersTable.id }).from(customersTable)
      .where(and(eq(customersTable.id, parseInt(customer_id)), eq(customersTable.company_id, companyId)));
    if (!ownC) { res.status(400).json({ error: "المورد غير موجود" }); return; }
  }

  const reqProductIds2 = Array.from(new Set(items.map((i: { product_id: number }) => Number(i.product_id))));
  if (reqProductIds2.length > 0) {
    const ownedProducts2 = await db.select({ id: productsTable.id }).from(productsTable)
      .where(and(inArray(productsTable.id, reqProductIds2 as number[]), eq(productsTable.company_id, companyId)));
    if (ownedProducts2.length !== reqProductIds2.length) {
      res.status(400).json({ error: "أحد المنتجات غير موجود" }); return;
    }
  }

  const requestId = req.headers["x-request-id"] ? String(req.headers["x-request-id"]) : null;
  if (requestId) {
    const [existing] = await db.select().from(purchaseReturnsTable)
      .where(and(eq(purchaseReturnsTable.request_id, requestId), eq(purchaseReturnsTable.company_id, companyId))).limit(1);
    if (existing) return res.json({ ...existing, total_amount: Number(existing.total_amount), created_at: existing.created_at.toISOString() });
  }

  const total: number = items.reduce((s: number, i: { total_price: number }) => s + Number(i.total_price), 0);
  const return_no = await nextPurchaseReturnNo(companyId);
  const txDate = date ?? new Date().toISOString().split("T")[0];
  const rtype: string = refund_type === "cash" ? "cash" : "balance_credit";

  await assertPeriodOpen(txDate, req);

  const effectiveWarehouseId = req.user?.warehouse_id ?? null;
  const tenantWarehouseId = await resolveTenantWarehouseId(effectiveWarehouseId, companyId);

  const ret = await db.transaction(async (tx) => {
    let safeIdInt: number | null = null;
    let safeNameStr: string | null = null;
    if (rtype === "cash") {
      if (!safe_id) throw httpError(400, "يجب اختيار الخزينة للاسترداد النقدي");
      const [safe] = await tx.select().from(safesTable).where(and(eq(safesTable.id, parseInt(safe_id)), eq(safesTable.company_id, companyId)));
      if (!safe) throw httpError(400, "الخزينة غير موجودة");
      safeIdInt   = safe.id;
      safeNameStr = safe.name;

      await tx.update(safesTable)
        .set({ balance: String(Number(safe.balance) + total) })
        .where(and(eq(safesTable.id, safe.id), eq(safesTable.company_id, companyId)));

      await tx.insert(transactionsTable).values({
        type: "purchase_return",
        reference_type: "purchase_return",
        safe_id: safe.id,
        safe_name: safe.name,
        amount: String(total),
        direction: "in",
        description: `مرتجع مشتريات نقدي ${return_no}${supplier_name ? ` — ${supplier_name}` : ""}`,
        date: txDate,
        company_id: companyId,
      });
    } else {
      if (customer_id) {
        const custId = parseInt(customer_id);
        const [cust] = await tx.select().from(customersTable).where(and(eq(customersTable.id, custId), eq(customersTable.company_id, companyId)));
        if (cust) {
          await tx.update(customersTable)
            .set({ balance: String(Number(cust.balance) + total) })
            .where(and(eq(customersTable.id, custId), eq(customersTable.company_id, companyId)));
        }
        await tx.insert(customerLedgerTable).values({
          customer_id: custId,
          type: "purchase_return",
          amount: String(total),
          reference_type: "purchase_return",
          reference_id: 0,
          reference_no: return_no,
          description: `مرتجع مشتريات ${return_no}${customer_name ? ` — ${customer_name}` : ""}`,
          date: txDate,
          company_id: companyId,
        });
      }
    }

    const [ret] = await tx.insert(purchaseReturnsTable).values({
      request_id: requestId,
      return_no,
      purchase_id: purchase_id ?? null,
      customer_id: customer_id ? parseInt(customer_id) : null,
      customer_name: customer_name ?? supplier_name ?? null,
      total_amount: String(total),
      refund_type: rtype,
      safe_id: safeIdInt,
      safe_name: safeNameStr,
      date: txDate,
      reason: reason ?? null,
      notes: notes ?? null,
      company_id: companyId,
    }).returning();

    for (const item of items) {
      const retQty    = Number(item.quantity);
      if (retQty <= 0) throw httpError(400, `كمية المرتجع للصنف "${item.product_name}" يجب أن تكون أكبر من صفر`);
      const origPurchaseItemId: number | null = item.original_purchase_item_id
        ? parseInt(item.original_purchase_item_id)
        : null;

      let historicalUnitCost: number = Number(item.unit_price);
      let resolvedPurchItemId: number | null = origPurchaseItemId;

      if (origPurchaseItemId) {
        if (!purchase_id) throw httpError(400, "يجب تحديد فاتورة الشراء الأصلية عند تمرير بند شراء أصلي");
        const [origItem] = await tx.select().from(purchaseItemsTable)
          .where(and(eq(purchaseItemsTable.id, origPurchaseItemId), eq(purchaseItemsTable.purchase_id, parseInt(purchase_id))));
        if (!origItem) throw httpError(400, `بند الشراء الأصلي ${origPurchaseItemId} غير موجود`);

        const alreadyReturned = Number(origItem.quantity_returned);
        const remaining       = Number(origItem.quantity) - alreadyReturned;
        if (retQty > remaining + 0.0001) {
          throw httpError(400,
            `الكمية المطلوب إرجاعها (${retQty}) تتجاوز الكمية المتاحة للإرجاع (${remaining.toFixed(3)}) للبند ${origItem.product_name}`
          );
        }
        historicalUnitCost = Number(origItem.unit_price);
        await tx.update(purchaseItemsTable)
          .set({ quantity_returned: String((alreadyReturned + retQty).toFixed(3)) })
          .where(and(eq(purchaseItemsTable.id, origPurchaseItemId), eq(purchaseItemsTable.purchase_id, parseInt(purchase_id))));
      } else if (purchase_id) {
        const origItems = await tx.select().from(purchaseItemsTable)
          .where(and(
            eq(purchaseItemsTable.purchase_id, parseInt(purchase_id)),
            eq(purchaseItemsTable.product_id, item.product_id),
          ));
        if (origItems.length > 0) {
          const available = origItems.find(r =>
            (Number(r.quantity) - Number(r.quantity_returned)) >= retQty - 0.0001
          ) ?? origItems[0];
          historicalUnitCost = Number(available.unit_price);
          resolvedPurchItemId = available.id;
          const alreadyReturned = Number(available.quantity_returned);
          await tx.update(purchaseItemsTable)
            .set({ quantity_returned: String((alreadyReturned + retQty).toFixed(3)) })
            .where(and(eq(purchaseItemsTable.id, available.id), eq(purchaseItemsTable.purchase_id, parseInt(purchase_id))));
        }
      }

      const totalCostAtReturn = historicalUnitCost * retQty;
      await tx.insert(purchaseReturnItemsTable).values({
        return_id:                 ret.id,
        product_id:                item.product_id,
        product_name:              item.product_name,
        quantity:                  String(retQty),
        unit_price:                String(item.unit_price),
        total_price:               String(item.total_price),
        original_purchase_item_id: resolvedPurchItemId,
        unit_cost_at_return:       String(historicalUnitCost),
        total_cost_at_return:      String(totalCostAtReturn),
      });

      const [prod] = await tx.select().from(productsTable).where(and(eq(productsTable.id, item.product_id), eq(productsTable.company_id, companyId)));
      if (prod) {
        const oldQty  = Number(prod.quantity);
        const oldWAC  = Number(prod.cost_price);
        const newQty  = Math.max(0, oldQty - retQty);
        let   newWAC  = oldWAC;
        if (newQty > 0) {
          const oldTotalValue = oldQty * oldWAC;
          const returnedValue = retQty * historicalUnitCost;
          newWAC = Math.max(0, (oldTotalValue - returnedValue) / newQty);
        }
        await tx.update(productsTable)
          .set({ quantity: String(newQty), cost_price: String(newWAC.toFixed(4)) })
          .where(and(eq(productsTable.id, item.product_id), eq(productsTable.company_id, companyId)));
        await tx.insert(stockMovementsTable).values({
          product_id:      item.product_id,
          product_name:    item.product_name,
          movement_type:   "purchase_return",
          quantity:        String(-retQty),
          quantity_before: String(oldQty),
          quantity_after:  String(newQty),
          unit_cost:       String(historicalUnitCost),
          reference_type:  "purchase_return",
          reference_id:    ret.id,
          reference_no:    return_no,
          notes: supplier_name ? `مرتجع مشتريات لـ ${supplier_name}` : "مرتجع مشتريات",
          date: txDate,
          warehouse_id: tenantWarehouseId,
          company_id:   companyId,
        });
      }
    }

    return ret;
  });

  void writeAuditLog({
    action: "create",
    record_type: "purchase_return",
    record_id: ret.id,
    new_value: { return_no: ret.return_no, total: Number(ret.total_amount) },
    user: { id: req.user?.id, username: req.user?.username },
  });

  return res.status(201).json({ ...ret, total_amount: Number(ret.total_amount), created_at: ret.created_at.toISOString() });
}));

router.delete("/purchase-returns/:id", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_cancel_sale")) {
    res.status(403).json({ error: "غير مصرح بحذف مرتجعات المشتريات" }); return;
  }
  const id = parseInt(req.params.id as string);
  const companyId = getTenant(req);
  const [preCheck] = await db.select({ date: purchaseReturnsTable.date })
    .from(purchaseReturnsTable).where(and(eq(purchaseReturnsTable.id, id), eq(purchaseReturnsTable.company_id, companyId)));
  if (!preCheck) throw httpError(404, "غير موجود");
  await assertPeriodOpen(preCheck.date, req);

  const effectiveWarehouseId = req.user?.warehouse_id ?? null;
  const tenantWarehouseId = await resolveTenantWarehouseId(effectiveWarehouseId, companyId);

  await db.transaction(async (tx) => {
    const [ret] = await tx.select().from(purchaseReturnsTable).where(and(eq(purchaseReturnsTable.id, id), eq(purchaseReturnsTable.company_id, companyId)));
    if (!ret) throw httpError(400, "غير موجود");

    const retItems = await tx.select().from(purchaseReturnItemsTable).where(eq(purchaseReturnItemsTable.return_id, id));

    for (const item of retItems) {
      const retQty       = Number(item.quantity);
      const unitCostUsed = Number(item.unit_cost_at_return) || Number(item.unit_price);

      if (item.original_purchase_item_id && ret.purchase_id) {
        const [origItem] = await tx.select().from(purchaseItemsTable)
          .where(and(eq(purchaseItemsTable.id, item.original_purchase_item_id), eq(purchaseItemsTable.purchase_id, ret.purchase_id)));
        if (origItem) {
          const newReturned = Math.max(0, Number(origItem.quantity_returned) - retQty);
          await tx.update(purchaseItemsTable)
            .set({ quantity_returned: String(newReturned.toFixed(3)) })
            .where(and(eq(purchaseItemsTable.id, origItem.id), eq(purchaseItemsTable.purchase_id, ret.purchase_id)));
        }
      }

      const [prod] = await tx.select().from(productsTable).where(and(eq(productsTable.id, item.product_id), eq(productsTable.company_id, companyId)));
      if (prod) {
        const oldQty = Number(prod.quantity);
        const oldWAC = Number(prod.cost_price);
        const newQty = oldQty + retQty;
        const newWAC = newQty > 0
          ? ((oldQty * oldWAC) + (retQty * unitCostUsed)) / newQty
          : unitCostUsed;
        await tx.update(productsTable)
          .set({ quantity: String(newQty), cost_price: String(newWAC.toFixed(4)) })
          .where(and(eq(productsTable.id, item.product_id), eq(productsTable.company_id, companyId)));
        await tx.insert(stockMovementsTable).values({
          product_id:      item.product_id,
          product_name:    item.product_name,
          movement_type:   "adjustment",
          quantity:        String(retQty),
          quantity_before: String(oldQty),
          quantity_after:  String(newQty),
          unit_cost:       String(unitCostUsed),
          reference_type:  "purchase_return_cancel",
          reference_id:    ret.id,
          reference_no:    ret.return_no,
          notes:           `إلغاء مرتجع مشتريات ${ret.return_no}`,
          date:            new Date().toISOString().split("T")[0],
          warehouse_id:    tenantWarehouseId,
          company_id:      companyId,
        });
      }
    }

    const total = Number(ret.total_amount);

    if (ret.refund_type === "cash" && ret.safe_id) {
      const [safe] = await tx.select().from(safesTable).where(and(eq(safesTable.id, ret.safe_id), eq(safesTable.company_id, companyId)));
      if (safe) {
        await tx.update(safesTable)
          .set({ balance: String(Number(safe.balance) - total) })
          .where(and(eq(safesTable.id, ret.safe_id), eq(safesTable.company_id, companyId)));
      }
    } else if (ret.refund_type === "balance_credit" || !ret.refund_type) {
      if (ret.customer_id) {
        const [cust] = await tx.select().from(customersTable).where(and(eq(customersTable.id, ret.customer_id), eq(customersTable.company_id, companyId)));
        if (cust) {
          await tx.update(customersTable)
            .set({ balance: String(Number(cust.balance) - total) })
            .where(and(eq(customersTable.id, ret.customer_id), eq(customersTable.company_id, companyId)));
        }
        await tx.insert(customerLedgerTable).values({
          customer_id: ret.customer_id,
          type: "purchase_return_cancel",
          amount: String(-total),
          reference_type: "purchase_return_cancel",
          reference_id: ret.id,
          reference_no: ret.return_no,
          description: `إلغاء مرتجع مشتريات ${ret.return_no}`,
          date: new Date().toISOString().split("T")[0],
          company_id: companyId,
        });
      }
    }

    await tx.delete(purchaseReturnItemsTable).where(eq(purchaseReturnItemsTable.return_id, id));
    await tx.delete(purchaseReturnsTable).where(eq(purchaseReturnsTable.id, id));
  });

  void writeAuditLog({
    action: "delete",
    record_type: "purchase_return",
    record_id: id,
    user: { id: req.user?.id, username: req.user?.username },
  });

  res.json({ success: true });
}));

export default router;
