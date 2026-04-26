/**
 * inventory-control.ts — جرد المخزون وتحويل المخزون بين المخازن
 *
 * POST /api/inventory/count-sessions           — إنشاء جلسة جرد جديدة
 * GET  /api/inventory/count-sessions           — قائمة جلسات الجرد
 * GET  /api/inventory/count-sessions/:id       — تفاصيل جلسة
 * POST /api/inventory/count-sessions/:id/apply — تطبيق الجرد وإنشاء تسويات
 *
 * POST /api/inventory/transfers                — تحويل مخزون بين مخازن
 * GET  /api/inventory/transfers                — قائمة التحويلات
 */

import { Router, type IRouter } from "express";
import { eq, and, inArray, sql } from "drizzle-orm";
import { resolveTenantWarehouseId } from "../lib/warehouse-guard";
import {
  db,
  productsTable,
  stockMovementsTable,
  stockCountSessionsTable,
  stockCountItemsTable,
  warehousesTable,
} from "@workspace/db";
import { wrap } from "../lib/async-handler";
import { hasPermission } from "../lib/permissions";
import { writeAuditLog } from "../lib/audit-log";

const router: IRouter = Router();

/* ═══════════════════════════════════════════════════════════════════════════
 * SECTION A — جرد المخزون (Stock Count)
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * POST /api/inventory/count-sessions
 * ينشئ جلسة جرد جديدة ويُحمِّل كميات النظام الحالية لكل منتج
 *
 * Body: { warehouse_id, notes?, items: [{ product_id, physical_qty, notes? }] }
 */
router.post("/inventory/count-sessions", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_adjust_inventory")) {
    res.status(403).json({ error: "ليس لديك صلاحية إجراء جرد المخزون" }); return;
  }

  const { warehouse_id, notes, items } = req.body as {
    warehouse_id?: number;
    notes?: string;
    items: Array<{ product_id: number; physical_qty: number; notes?: string }>;
  };

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "يجب تحديد منتج واحد على الأقل في الجرد" }); return;
  }

  const companyId = req.user!.company_id!;
  const tenantWarehouseId = await resolveTenantWarehouseId(warehouse_id ?? null, companyId);

  const productIds = items.map(i => i.product_id);
  const products = await db.select().from(productsTable).where(and(inArray(productsTable.id, productIds), eq(productsTable.company_id, companyId)));
  const productMap = new Map(products.map(p => [p.id, p]));

  const missing = productIds.filter(id => !productMap.has(id));
  if (missing.length > 0) {
    res.status(400).json({ error: `منتجات غير موجودة: ${missing.join(", ")}` }); return;
  }

  // احسب المخزون الفعلي لكل منتج في المخزن المحدد من حركات المخزون
  const safeProductIdsCsv = productIds.map(Number).filter(Number.isInteger).join(",");
  const whStockRows = safeProductIdsCsv ? await db.execute(sql`
    SELECT product_id::int, COALESCE(SUM(CAST(quantity AS FLOAT8)), 0) AS wh_qty
    FROM stock_movements
    WHERE warehouse_id = ${tenantWarehouseId}
      AND company_id = ${companyId}
      AND product_id IN (${sql.raw(safeProductIdsCsv)})
    GROUP BY product_id
  `) : { rows: [] as Record<string, unknown>[] };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const whStockMap = new Map((whStockRows.rows as Record<string, unknown>[]).map((r: any) => [Number(r.product_id), Number(r.wh_qty ?? 0)]));

  const session = await db.transaction(async (tx) => {
    const [sess] = await tx.insert(stockCountSessionsTable).values({
      warehouse_id: tenantWarehouseId,
      status: "draft",
      notes: notes ?? null,
      company_id: companyId,
      created_by: req.user?.id ?? null,
    }).returning();

    const countItems = items.map(item => ({
      session_id:   sess.id,
      product_id:   item.product_id,
      system_qty:   String(whStockMap.get(item.product_id) ?? 0),
      physical_qty: String(item.physical_qty),
      notes:        item.notes ?? null,
    }));

    const inserted = await tx.insert(stockCountItemsTable).values(countItems).returning();
    return { session: sess, items: inserted };
  });

  res.status(201).json({
    success:    true,
    session_id: session.session.id,
    status:     session.session.status,
    items_count: session.items.length,
    items:      session.items.map(i => ({
      ...i,
      system_qty:   Number(i.system_qty),
      physical_qty: Number(i.physical_qty),
      difference:   Number(i.physical_qty) - Number(i.system_qty),
    })),
  });
}));

/**
 * GET /api/inventory/count-sessions
 * قائمة جلسات الجرد لهذه الشركة
 */
router.get("/inventory/count-sessions", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_inventory")) {
    res.status(403).json({ error: "ليس لديك صلاحية عرض الجرد" }); return;
  }

  const sessions = await db.select().from(stockCountSessionsTable)
    .where(eq(stockCountSessionsTable.company_id, req.user!.company_id!))
    .orderBy(stockCountSessionsTable.created_at);

  res.json(sessions.map(s => ({
    ...s,
    applied_at: s.applied_at?.toISOString() ?? null,
    created_at: s.created_at.toISOString(),
  })));
}));

/**
 * GET /api/inventory/count-sessions/:id
 * تفاصيل جلسة جرد واحدة مع بنودها
 */
router.get("/inventory/count-sessions/:id", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_inventory")) {
    res.status(403).json({ error: "ليس لديك صلاحية عرض الجرد" }); return;
  }

  const sessionId = parseInt(String(req.params.id));
  const [session] = await db.select().from(stockCountSessionsTable)
    .where(and(eq(stockCountSessionsTable.id, sessionId), eq(stockCountSessionsTable.company_id, req.user!.company_id!)));

  if (!session) { res.status(404).json({ error: "جلسة الجرد غير موجودة" }); return; }

  const items = await db
    .select({
      id:           stockCountItemsTable.id,
      session_id:   stockCountItemsTable.session_id,
      product_id:   stockCountItemsTable.product_id,
      product_name: productsTable.name,
      product_sku:  productsTable.sku,
      system_qty:   stockCountItemsTable.system_qty,
      physical_qty: stockCountItemsTable.physical_qty,
      notes:        stockCountItemsTable.notes,
    })
    .from(stockCountItemsTable)
    .innerJoin(productsTable, eq(stockCountItemsTable.product_id, productsTable.id))
    .where(eq(stockCountItemsTable.session_id, sessionId));

  res.json({
    session: {
      ...session,
      applied_at: session.applied_at?.toISOString() ?? null,
      created_at: session.created_at.toISOString(),
    },
    items: items.map(i => ({
      ...i,
      system_qty:   Number(i.system_qty),
      physical_qty: Number(i.physical_qty),
      difference:   Number(i.physical_qty) - Number(i.system_qty),
    })),
  });
}));

/**
 * POST /api/inventory/count-sessions/:id/apply
 * يطبّق الجرد:
 *   - لكل منتج يختلف فيه physical_qty عن system_qty يُنشئ stock_movement (adjustment)
 *   - يُحدِّث products.quantity
 *   - يغيّر حالة الجلسة إلى applied
 *   - يُسجِّل في audit_logs
 */
router.post("/inventory/count-sessions/:id/apply", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_adjust_inventory")) {
    res.status(403).json({ error: "ليس لديك صلاحية تطبيق الجرد" }); return;
  }

  const sessionId = parseInt(String(req.params.id));
  const [session] = await db.select().from(stockCountSessionsTable)
    .where(and(eq(stockCountSessionsTable.id, sessionId), eq(stockCountSessionsTable.company_id, req.user!.company_id!)));

  if (!session) { res.status(404).json({ error: "جلسة الجرد غير موجودة" }); return; }
  if (session.status === "applied") {
    res.status(409).json({ error: "تم تطبيق هذه الجلسة بالفعل" }); return;
  }

  const items = await db
    .select({
      id:           stockCountItemsTable.id,
      product_id:   stockCountItemsTable.product_id,
      system_qty:   stockCountItemsTable.system_qty,
      physical_qty: stockCountItemsTable.physical_qty,
      notes:        stockCountItemsTable.notes,
    })
    .from(stockCountItemsTable)
    .where(eq(stockCountItemsTable.session_id, sessionId));

  if (items.length === 0) {
    res.status(400).json({ error: "الجلسة لا تحتوي على بنود" }); return;
  }

  const productIds = items.map(i => i.product_id);
  const products = await db.select().from(productsTable).where(and(inArray(productsTable.id, productIds), eq(productsTable.company_id, req.user!.company_id!)));
  const productMap = new Map(products.map(p => [p.id, p]));
  const missingProd = productIds.filter(pid => !productMap.has(pid));
  if (missingProd.length > 0) {
    res.status(400).json({ error: `منتجات غير تابعة لشركتك: ${missingProd.join(", ")}` }); return;
  }

  const adjustments: Array<{ product_id: number; diff: number; oldQty: number; newQty: number }> = [];

  await db.transaction(async (tx) => {
    for (const item of items) {
      const sysQty  = Number(item.system_qty);
      const physQty = Number(item.physical_qty);
      const diff    = physQty - sysQty;

      if (Math.abs(diff) < 0.001) continue; // لا فرق — تجاوز

      const product = productMap.get(item.product_id)!;
      const oldQty  = Number(product.quantity);
      const newQty  = oldQty + diff; // قد يختلف عن sysQty إذا وجدت حركات بعد بدء الجرد

      // تحديث كمية المنتج
      await tx.update(productsTable)
        .set({ quantity: String(newQty) })
        .where(and(eq(productsTable.id, item.product_id), eq(productsTable.company_id, req.user!.company_id!)));

      // تسجيل حركة المخزون
      const refNo = `CNT-${session.id}-${item.product_id}`;
      await tx.insert(stockMovementsTable).values({
        product_id:     item.product_id,
        product_name:   product.name,
        movement_type:  "adjustment",
        quantity:       String(diff),
        quantity_before: String(oldQty),
        quantity_after:  String(newQty),
        unit_cost:      product.cost_price,
        reference_type: "stock_count",
        reference_id:   session.id,
        reference_no:   refNo,
        notes: item.notes ?? `جرد مخزون — جلسة #${session.id}`,
        date:  new Date().toISOString().split("T")[0],
        warehouse_id:  session.warehouse_id,
        company_id:    session.company_id,
      });

      adjustments.push({ product_id: item.product_id, diff, oldQty, newQty });
    }

    // تحديث حالة الجلسة
    await tx.update(stockCountSessionsTable)
      .set({ status: "applied", applied_at: new Date() })
      .where(and(eq(stockCountSessionsTable.id, sessionId), eq(stockCountSessionsTable.company_id, req.user!.company_id!)));
  });

  // سجل audit
  void writeAuditLog({
    action:      "INVENTORY_COUNT_APPLIED",
    record_type: "product",
    record_id:   sessionId,
    old_value:   { session_id: sessionId, warehouse_id: session.warehouse_id, status: "draft" },
    new_value:   {
      status:           "applied",
      adjustments_count: adjustments.length,
      adjustments:      adjustments.slice(0, 20), // أقصى 20 لتجنب overflow
    },
    user: { id: req.user?.id, username: req.user?.username },
  });

  res.json({
    success:           true,
    session_id:        sessionId,
    adjustments_applied: adjustments.length,
    adjustments,
  });
}));

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
 */
router.post("/inventory/transfers", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_adjust_inventory")) {
    res.status(403).json({ error: "ليس لديك صلاحية تحويل المخزون" }); return;
  }

  const { from_warehouse_id, to_warehouse_id, items } = req.body as {
    from_warehouse_id: number;
    to_warehouse_id:   number;
    notes?:            string;
    items: Array<{ product_id: number; quantity: number }>;
  };

  // التحقق من عدم التحويل لنفس المخزن
  if (Number(from_warehouse_id) === Number(to_warehouse_id)) {
    res.status(400).json({ error: "لا يمكن التحويل من مخزن إلى نفس المخزن" }); return;
  }

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "يجب تحديد منتج واحد على الأقل" }); return;
  }

  // ── Aggregate duplicate product lines to prevent stock-check bypass ──────
  const aggregatedMap = new Map<number, number>();
  for (const it of items) {
    const pid = Number(it.product_id);
    const qty = Number(it.quantity);
    aggregatedMap.set(pid, (aggregatedMap.get(pid) ?? 0) + qty);
  }
  const aggregatedItems = Array.from(aggregatedMap.entries()).map(([pid, qty]) => ({ product_id: pid, quantity: qty }));

  // التحقق من أن المخازن موجودة وتنتمي للشركة
  const companyIdT = req.user!.company_id!;
  const [fromWH] = await db.select().from(warehousesTable).where(and(eq(warehousesTable.id, Number(from_warehouse_id)), eq(warehousesTable.company_id, companyIdT)));
  const [toWH]   = await db.select().from(warehousesTable).where(and(eq(warehousesTable.id, Number(to_warehouse_id)), eq(warehousesTable.company_id, companyIdT)));
  if (!fromWH) { res.status(404).json({ error: `مخزن المصدر غير موجود: ${from_warehouse_id}` }); return; }
  if (!toWH)   { res.status(404).json({ error: `مخزن الهدف غير موجود: ${to_warehouse_id}` }); return; }

  // جلب المنتجات
  const productIds = items.map(i => i.product_id);
  const products   = await db.select().from(productsTable).where(and(inArray(productsTable.id, productIds), eq(productsTable.company_id, companyIdT)));
  const productMap = new Map(products.map(p => [p.id, p]));

  // ─── حساب كمية كل منتج في مخزن المصدر فقط (من حركات المخزون) ─────────────
  // المنطق: SUM(quantity) لكل منتج في هذا المخزن = الرصيد الفعلي الحالي
  // (حركات الدخول موجبة، حركات الخروج سالبة — مسجّلة هكذا في stock_movements)
  const safeIdsCsvT = productIds.map(Number).filter(Number.isInteger).join(",");
  const fromStockRows = safeIdsCsvT ? await db.execute(sql`
    SELECT product_id::int,
           COALESCE(SUM(CAST(quantity AS FLOAT8)), 0) AS wh_qty
    FROM   stock_movements
    WHERE  warehouse_id = ${Number(from_warehouse_id)}
      AND  company_id   = ${companyIdT}
      AND  product_id   IN (${sql.raw(safeIdsCsvT)})
    GROUP BY product_id
  `) : { rows: [] as Record<string, unknown>[] };
  const fromStockMap = new Map<number, number>(
    (fromStockRows.rows as Array<{ product_id: number; wh_qty: number }>)
      .map(r => [Number(r.product_id), Number(r.wh_qty ?? 0)])
  );

  // جلب رصيد مخزن الهدف أيضاً لتسجيل quantity_before صحيح
  const toStockRows = safeIdsCsvT ? await db.execute(sql`
    SELECT product_id::int,
           COALESCE(SUM(CAST(quantity AS FLOAT8)), 0) AS wh_qty
    FROM   stock_movements
    WHERE  warehouse_id = ${Number(to_warehouse_id)}
      AND  company_id   = ${companyIdT}
      AND  product_id   IN (${sql.raw(safeIdsCsvT)})
    GROUP BY product_id
  `) : { rows: [] as Record<string, unknown>[] };
  const toStockMap = new Map<number, number>(
    (toStockRows.rows as Array<{ product_id: number; wh_qty: number }>)
      .map(r => [Number(r.product_id), Number(r.wh_qty ?? 0)])
  );

  // ─── التحقق من توفر الكمية في مخزن المصدر تحديداً (على المجاميع) ───────
  for (const item of aggregatedItems) {
    const product = productMap.get(item.product_id);
    if (!product) {
      res.status(404).json({ error: `المنتج غير موجود: ${item.product_id}` }); return;
    }
    if (item.quantity <= 0) {
      res.status(400).json({ error: `الكمية يجب أن تكون موجبة للمنتج: ${product.name}` }); return;
    }
    // الكمية المتاحة في المخزن المصدر (0 إذا لم يسبق نقل أي كمية له)
    const availableInWarehouse = fromStockMap.get(item.product_id) ?? 0;
    if (availableInWarehouse < item.quantity) {
      res.status(400).json({
        error: `الكمية غير كافية في "${fromWH.name}" للمنتج "${product.name}": المتاح ${availableInWarehouse.toFixed(3)}، المطلوب ${item.quantity}`,
        available_in_warehouse: availableInWarehouse,
        warehouse_name: fromWH.name,
      }); return;
    }
  }

  const transferId = await db.transaction(async (tx) => {
    const today = new Date().toISOString().split("T")[0];
    // رقم مرجعي مؤقت بناءً على الوقت (سيُستبدل بـ id الفعلي بعد الإدراج)
    const tempRef = `WH-TRF-${Date.now()}`;

    for (const item of aggregatedItems) {
      const product = productMap.get(item.product_id)!;
      const qty = Number(item.quantity);

      const fromQtyBefore = fromStockMap.get(item.product_id) ?? 0;
      const fromQtyAfter  = fromQtyBefore - qty;
      const toQtyBefore   = toStockMap.get(item.product_id) ?? 0;
      const toQtyAfter    = toQtyBefore + qty;

      // حركة خروج من المخزن المصدر
      await tx.insert(stockMovementsTable).values({
        product_id:      item.product_id,
        product_name:    product.name,
        movement_type:   "transfer_out",
        quantity:        String(-qty),
        quantity_before: String(fromQtyBefore),
        quantity_after:  String(fromQtyAfter),
        unit_cost:       product.cost_price,
        reference_type:  "stock_transfer",
        reference_no:    tempRef,
        notes: `تحويل مخزن خروج → ${toWH.name}`,
        date:  today,
        warehouse_id:  Number(from_warehouse_id),
        company_id:    req.user!.company_id!,
      });

      // حركة دخول إلى المخزن الهدف
      await tx.insert(stockMovementsTable).values({
        product_id:      item.product_id,
        product_name:    product.name,
        movement_type:   "transfer_in",
        quantity:        String(qty),
        quantity_before: String(toQtyBefore),
        quantity_after:  String(toQtyAfter),
        unit_cost:       product.cost_price,
        reference_type:  "stock_transfer",
        reference_no:    tempRef,
        notes: `تحويل مخزن دخول ← ${fromWH.name}`,
        date:  today,
        warehouse_id:  Number(to_warehouse_id),
        company_id:    req.user!.company_id!,
      });
    }

    return tempRef;
  });

  void writeAuditLog({
    action:      "INVENTORY_TRANSFER",
    record_type: "product",
    record_id:   0,
    old_value:   { from_warehouse: fromWH.name, from_warehouse_id },
    new_value:   {
      to_warehouse: toWH.name, to_warehouse_id,
      items_count: items.length,
      items: items.map(i => ({
        product_id:   i.product_id,
        product_name: productMap.get(i.product_id)?.name,
        quantity:     i.quantity,
      })),
    },
    user: { id: req.user?.id, username: req.user?.username },
  });

  res.status(201).json({
    success:     true,
    transfer_id: transferId,
    from_warehouse: fromWH.name,
    to_warehouse:   toWH.name,
    items_count: items.length,
  });
}));

/**
 * GET /api/inventory/transfers
 * تحويلات المخازن — مُؤقتاً يُعيد حركات المخزون من نوع transfer_out
 * سيُستبدل بـ GET /api/stock-transfers في الخطوة التالية
 */
router.get("/inventory/transfers", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_inventory")) {
    res.status(403).json({ error: "ليس لديك صلاحية عرض التحويلات" }); return;
  }
  const companyId = req.user!.company_id!;
  const rows = await db
    .select()
    .from(stockMovementsTable)
    .where(
      eq(stockMovementsTable.company_id, companyId)
    )
    .orderBy(stockMovementsTable.created_at);
  const transfers = rows.filter(r => r.movement_type === "transfer_out" || r.movement_type === "transfer_in");
  res.json(transfers.map(t => ({
    ...t,
    quantity:        Number(t.quantity),
    quantity_before: Number(t.quantity_before ?? 0),
    quantity_after:  Number(t.quantity_after  ?? 0),
    created_at:      t.created_at.toISOString(),
  })));
}));

/**
 * GET /api/inventory/count-sessions-enriched
 * Same as count-sessions but includes items_count and adjustments_count per session.
 */
router.get("/inventory/count-sessions-enriched", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_inventory")) {
    res.status(403).json({ error: "ليس لديك صلاحية عرض الجرد" }); return;
  }

  const cidEnriched = req.user!.company_id!;
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

  res.json((rows.rows as Record<string, unknown>[]).map(r => ({
    id:                Number(r.id),
    warehouse_id:      Number(r.warehouse_id),
    status:            String(r.status),
    notes:             r.notes ? String(r.notes) : null,
    company_id:        Number(r.company_id),
    created_by:        r.created_by ? Number(r.created_by) : null,
    created_at:        new Date(String(r.created_at)).toISOString(),
    applied_at:        r.applied_at ? new Date(String(r.applied_at)).toISOString() : null,
    items_count:       Number(r.items_count ?? 0),
    adjustments_count: Number(r.adjustments_count ?? 0),
  })));
}));

/**
 * GET /api/inventory/transfers-enriched
 * Same as transfers but includes items_count and total_qty per transfer.
 */
router.get("/inventory/transfers-enriched", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_inventory")) {
    res.status(403).json({ error: "ليس لديك صلاحية عرض التحويلات" }); return;
  }

  const cidT = req.user!.company_id!;
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

  res.json((rows.rows as Record<string, unknown>[]).map(r => ({
    id:                Number(r.id),
    from_warehouse_id: Number(r.from_warehouse_id),
    to_warehouse_id:   Number(r.to_warehouse_id),
    status:            String(r.status),
    notes:             r.notes ? String(r.notes) : null,
    company_id:        Number(r.company_id),
    created_by:        r.created_by ? Number(r.created_by) : null,
    created_at:        new Date(String(r.created_at)).toISOString(),
    items_count:       Number(r.items_count ?? 0),
    total_qty:         Math.round(Number(r.total_qty ?? 0) * 1000) / 1000,
  })));
}));

export default router;
