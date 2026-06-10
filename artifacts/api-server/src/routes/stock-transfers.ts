/**
 * stock-transfers.ts — تحويل المخزون بين الفروع
 *
 * POST /api/transfers/request          — إنشاء طلب تحويل جديد
 * POST /api/transfers/approve/:id      — اعتماد الطلب
 * POST /api/transfers/ship/:id         — شحن (يخصم المخزون من فرع المصدر)
 * POST /api/transfers/confirm/:id      — استلام (يضيف المخزون لفرع الوجهة)
 * POST /api/transfers/cancel/:id       — إلغاء الطلب
 * GET  /api/transfers                  — قائمة التحويلات (مع فلاتر اختيارية)
 */

import { Router, type IRouter } from 'express';
import { eq, and, sql, or, desc } from 'drizzle-orm';
import {
  db,
  stockTransfersTable,
  stockMovementsTable,
  notificationsTable,
  productsTable,
  branchesTable,
  warehousesTable,
} from '@workspace/db';
import { wrap, httpError } from '../lib/async-handler';
import { getTenant } from '../middleware/auth';
import { hasPermission } from '../lib/permissions';
import { requireUser } from '../lib/tenant';
import {
  stockTransferRequestSchema,
  stockTransferConfirmSchema,
  idParamSchema,
  firstZodError,
} from '../lib/schemas';

// ─── مساعد: إشعار صامت (fire-and-forget) ────────────────────────────────────
function notify(
  companyId: number,
  userId: number,
  type: string,
  title: string,
  message: string,
  referenceId: number
) {
  db.insert(notificationsTable)
    .values({
      company_id: companyId,
      user_id: userId,
      type,
      title,
      message,
      link: '/transfers',
      reference_id: referenceId,
    })
    .catch(() => {
      /* silent — لا نوقف العملية بسبب إشعار */
    });
}

const router: IRouter = Router();

// ─── مساعد: رصيد منتج في فرع (عبر مخازن الفرع) ──────────────────────────────
async function getBranchProductStock(
  productId: number,
  branchId: number,
  companyId: number
): Promise<number> {
  const result = await db.execute(sql`
    SELECT COALESCE(SUM(CAST(sm.quantity AS FLOAT8)), 0) AS stock
    FROM   stock_movements sm
    INNER  JOIN warehouses w ON w.id = sm.warehouse_id AND w.company_id = sm.company_id
    WHERE  sm.product_id  = ${productId}
      AND  sm.company_id  = ${companyId}
      AND  w.branch_id    = ${branchId}
  `);
  const rows = result.rows as Array<{ stock: string | number }>;
  return Number(rows[0]?.stock ?? 0);
}

// ─── مساعد: المخزن الأول لفرع (للتسجيل في stock_movements) ──────────────────
async function getPrimaryWarehouseId(branchId: number, companyId: number): Promise<number> {
  const [wh] = await db
    .select({ id: warehousesTable.id })
    .from(warehousesTable)
    .where(and(eq(warehousesTable.branch_id, branchId), eq(warehousesTable.company_id, companyId)))
    .limit(1);
  if (!wh) {
    throw httpError(400, 'لا يوجد مخزن مرتبط بهذا الفرع — يرجى إنشاء مخزن للفرع أولاً');
  }
  return wh.id;
}

// ─── مساعد: التحقق من ملكية الفرع للشركة ────────────────────────────────────
async function assertBranchOwnership(branchId: number, companyId: number, label: string) {
  const [branch] = await db
    .select({ id: branchesTable.id, name: branchesTable.name })
    .from(branchesTable)
    .where(and(eq(branchesTable.id, branchId), eq(branchesTable.company_id, companyId)));
  if (!branch) throw httpError(403, `${label} غير موجود أو لا ينتمي لشركتك`);
  return branch;
}

// ─── مساعد: توليد رمز تحقق 6 أرقام ──────────────────────────────────────────
function generateVerificationCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ─── مساعد: صياغة استجابة التحويل ───────────────────────────────────────────
function formatTransfer(t: typeof stockTransfersTable.$inferSelect) {
  return {
    ...t,
    quantity: Number(t.quantity),
    created_at: t.created_at.toISOString(),
    approved_at: t.approved_at?.toISOString() ?? null,
    shipped_at: t.shipped_at?.toISOString() ?? null,
    received_at: t.received_at?.toISOString() ?? null,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. POST /api/transfers/request — إنشاء طلب تحويل
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.post(
  '/transfers/request',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_view_inventory')) {
      throw httpError(403, 'ليس لديك صلاحية إنشاء طلبات التحويل');
    }

    const companyId = getTenant(req);
    const userId = requireUser(req).id;

    const bodyResult = stockTransferRequestSchema.safeParse(req.body);
    if (!bodyResult.success) {
      throw httpError(400, firstZodError(bodyResult.error));
    }
    const { product_id, from_branch_id, to_branch_id, quantity: qty, notes } = bodyResult.data;

    // ── التحقق من ملكية الفروع ──
    const [fromBranch, toBranch] = await Promise.all([
      assertBranchOwnership(from_branch_id, companyId, 'فرع الإرسال'),
      assertBranchOwnership(to_branch_id, companyId, 'فرع الاستلام'),
    ]);

    // ── التحقق من وجود المنتج ──
    const [product] = await db
      .select({ id: productsTable.id, name: productsTable.name })
      .from(productsTable)
      .where(and(eq(productsTable.id, product_id), eq(productsTable.company_id, companyId)));
    if (!product) throw httpError(404, 'المنتج غير موجود أو لا ينتمي لشركتك');

    // ── التحقق من توفر المخزون في فرع المصدر ──
    const availableStock = await getBranchProductStock(product.id, fromBranch.id, companyId);
    if (availableStock < qty) {
      throw httpError(
        400,
        `المخزون غير كافٍ في "${fromBranch.name}": المتاح ${availableStock.toFixed(3)}، المطلوب ${qty}`
      );
    }

    // ── إنشاء طلب التحويل ──
    const [transfer] = await db
      .insert(stockTransfersTable)
      .values({
        company_id: companyId,
        product_id: product.id,
        product_name: product.name,
        quantity: String(qty),
        from_branch_id: fromBranch.id,
        to_branch_id: toBranch.id,
        status: 'pending',
        verification_code: generateVerificationCode(),
        created_by: userId,
        notes: notes ?? null,
      })
      .returning();

    // إشعار المُنشئ بتأكيد الإنشاء
    notify(
      companyId,
      userId,
      'transfer_request',
      'طلب تحويل جديد',
      `طلب تحويل ${product.name} (${qty} وحدة) من ${fromBranch.name} إلى ${toBranch.name}`,
      transfer.id
    );

    res.status(201).json({
      ...formatTransfer(transfer),
      message: 'تم إنشاء طلب التحويل بنجاح',
    });
  })
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2. POST /api/transfers/approve/:id — اعتماد الطلب
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.post(
  '/transfers/approve/:id',
  wrap(async (req, res) => {
    const companyId = getTenant(req);
    const userId = requireUser(req).id;
    const transferId = Number(req.params.id);

    if (isNaN(transferId)) throw httpError(400, 'معرّف التحويل غير صالح');

    // ── جلب التحويل مع قفل ──
    const [transfer] = await db
      .select()
      .from(stockTransfersTable)
      .where(
        and(eq(stockTransfersTable.id, transferId), eq(stockTransfersTable.company_id, companyId))
      );

    if (!transfer) throw httpError(404, 'طلب التحويل غير موجود');
    if (transfer.status !== 'pending') {
      throw httpError(409, `لا يمكن الاعتماد — الحالة الحالية: ${transfer.status}`);
    }

    const [updated] = await db
      .update(stockTransfersTable)
      .set({
        status: 'approved',
        approved_by: userId,
        approved_at: new Date(),
      })
      .where(
        and(
          eq(stockTransfersTable.id, transferId),
          eq(stockTransfersTable.company_id, companyId),
          eq(stockTransfersTable.status, 'pending')
        )
      )
      .returning();

    if (!updated) throw httpError(409, 'فشل الاعتماد — ربما تغيرت الحالة للتو');

    // إشعار المُنشئ بأن طلبه اعتُمد
    if (updated.created_by) {
      notify(
        companyId,
        updated.created_by,
        'transfer_approved',
        'تم اعتماد طلب التحويل ✅',
        `طلب تحويل ${updated.product_name} (${updated.quantity} وحدة) — اعتُمد وجاهز للشحن`,
        updated.id
      );
    }

    res.json({ ...formatTransfer(updated), message: 'تم اعتماد طلب التحويل' });
  })
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3. POST /api/transfers/ship/:id — شحن (خصم المخزون من فرع المصدر)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.post(
  '/transfers/ship/:id',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_view_inventory')) {
      throw httpError(403, 'ليس لديك صلاحية شحن التحويل');
    }

    const companyId = getTenant(req);
    const userId = requireUser(req).id;
    const transferId = Number(req.params.id);

    if (isNaN(transferId)) throw httpError(400, 'معرّف التحويل غير صالح');

    // ── جلب التحويل ──
    const [transfer] = await db
      .select()
      .from(stockTransfersTable)
      .where(
        and(eq(stockTransfersTable.id, transferId), eq(stockTransfersTable.company_id, companyId))
      );

    if (!transfer) throw httpError(404, 'طلب التحويل غير موجود');
    if (transfer.status !== 'approved') {
      throw httpError(
        409,
        `لا يمكن الشحن — الحالة الحالية: ${transfer.status} (يجب أن تكون "approved")`
      );
    }

    const qty = Number(transfer.quantity);
    if (!transfer.from_branch_id) {
      throw httpError(400, 'فرع المصدر غير مُحدد في طلب التحويل');
    }
    const fromBranchId = transfer.from_branch_id;
    const today = new Date().toISOString().split('T')[0];

    const updated = await db.transaction(async (tx) => {
      // ── فحص المخزون مجدداً داخل المعاملة (للحماية من التحديثات المتزامنة) ──
      const stockResult = await tx.execute(sql`
      SELECT COALESCE(SUM(CAST(sm.quantity AS FLOAT8)), 0) AS stock
      FROM   stock_movements sm
      INNER  JOIN warehouses w ON w.id = sm.warehouse_id AND w.company_id = sm.company_id
      WHERE  sm.product_id  = ${transfer.product_id}
        AND  sm.company_id  = ${companyId}
        AND  w.branch_id    = ${fromBranchId}
      FOR SHARE
    `);
      const rows = stockResult.rows as Array<{ stock: string | number }>;
      const currentStock = Number(rows[0]?.stock ?? 0);

      if (currentStock < qty) {
        throw httpError(
          400,
          `المخزون غير كافٍ في فرع الإرسال: المتاح ${currentStock.toFixed(3)}، المطلوب ${qty}`
        );
      }

      // ── المخزن الأساسي لفرع المصدر ──
      const fromWarehouseId = await getPrimaryWarehouseId(fromBranchId, companyId);

      // ── حركة خروج (transfer_out) ──
      const qtyBefore = currentStock;
      const qtyAfter = qtyBefore - qty;

      await tx.insert(stockMovementsTable).values({
        product_id: transfer.product_id,
        product_name: transfer.product_name,
        movement_type: 'transfer_out',
        quantity: String(-qty),
        quantity_before: String(qtyBefore),
        quantity_after: String(qtyAfter),
        unit_cost: '0',
        reference_type: 'branch_transfer',
        reference_id: transferId,
        reference_no: `BTRF-${transferId}`,
        notes: `شحن تحويل فرع #${transferId}`,
        date: today,
        warehouse_id: fromWarehouseId,
        branch_id: fromBranchId,
        company_id: companyId,
      });

      // ── تحديث حالة التحويل (مع تحقق optimistic من الحالة) ──
      const [result] = await tx
        .update(stockTransfersTable)
        .set({
          status: 'shipped',
          shipped_by: userId,
          shipped_at: new Date(),
        })
        .where(
          and(
            eq(stockTransfersTable.id, transferId),
            eq(stockTransfersTable.company_id, companyId),
            eq(stockTransfersTable.status, 'approved')
          )
        )
        .returning();

      if (!result) throw httpError(409, 'فشل تحديث الحالة — ربما تغيرت الحالة للتو');
      return result;
    });

    // إشعار المُنشئ بأن الشحن بدأ
    if (updated.created_by) {
      notify(
        companyId,
        updated.created_by,
        'transfer_shipped',
        'تم شحن التحويل 🚚',
        `${updated.product_name} (${updated.quantity} وحدة) في الطريق — استخدم رمز التحقق للاستلام`,
        updated.id
      );
    }

    res.json({ ...formatTransfer(updated), message: 'تم شحن التحويل وخصم المخزون من فرع الإرسال' });
  })
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 4. POST /api/transfers/confirm/:id — استلام (إضافة مخزون لفرع الوجهة)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.post(
  '/transfers/confirm/:id',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_view_inventory')) {
      throw httpError(403, 'ليس لديك صلاحية تأكيد الاستلام');
    }

    const companyId = getTenant(req);
    const userId = requireUser(req).id;

    const paramsResult = idParamSchema.safeParse(req.params);
    if (!paramsResult.success) throw httpError(400, firstZodError(paramsResult.error));
    const transferId = paramsResult.data.id;

    const bodyResult = stockTransferConfirmSchema.safeParse(req.body);
    if (!bodyResult.success) throw httpError(400, firstZodError(bodyResult.error));
    const { verification_code } = bodyResult.data;

    // ── جلب التحويل ──
    const [transfer] = await db
      .select()
      .from(stockTransfersTable)
      .where(
        and(eq(stockTransfersTable.id, transferId), eq(stockTransfersTable.company_id, companyId))
      );

    if (!transfer) throw httpError(404, 'طلب التحويل غير موجود');
    if (transfer.status !== 'shipped') {
      throw httpError(
        409,
        `لا يمكن التأكيد — الحالة الحالية: ${transfer.status} (يجب أن تكون "shipped")`
      );
    }

    // ── التحقق من رمز التحقق ──
    if (verification_code.trim() !== String(transfer.verification_code)) {
      throw httpError(400, 'رمز التحقق غير صحيح');
    }

    const qty = Number(transfer.quantity);
    if (!transfer.to_branch_id) {
      throw httpError(400, 'فرع الوجهة غير مُحدد في طلب التحويل');
    }
    const toBranchId = transfer.to_branch_id;
    const today = new Date().toISOString().split('T')[0];

    const updated = await db.transaction(async (tx) => {
      // ── رصيد الفرع المستلم قبل الإضافة ──
      const toStockResult = await tx.execute(sql`
      SELECT COALESCE(SUM(CAST(sm.quantity AS FLOAT8)), 0) AS stock
      FROM   stock_movements sm
      INNER  JOIN warehouses w ON w.id = sm.warehouse_id AND w.company_id = sm.company_id
      WHERE  sm.product_id  = ${transfer.product_id}
        AND  sm.company_id  = ${companyId}
        AND  w.branch_id    = ${toBranchId}
    `);
      const toRows = toStockResult.rows as Array<{ stock: string | number }>;
      const toStockBefore = Number(toRows[0]?.stock ?? 0);
      const toStockAfter = toStockBefore + qty;

      // ── المخزن الأساسي لفرع الوجهة ──
      const toWarehouseId = await getPrimaryWarehouseId(toBranchId, companyId);

      // ── حركة دخول (transfer_in) ──
      await tx.insert(stockMovementsTable).values({
        product_id: transfer.product_id,
        product_name: transfer.product_name,
        movement_type: 'transfer_in',
        quantity: String(qty),
        quantity_before: String(toStockBefore),
        quantity_after: String(toStockAfter),
        unit_cost: '0',
        reference_type: 'branch_transfer',
        reference_id: transferId,
        reference_no: `BTRF-${transferId}`,
        notes: `استلام تحويل فرع #${transferId}`,
        date: today,
        warehouse_id: toWarehouseId,
        branch_id: toBranchId,
        company_id: companyId,
      });

      // ── تحديث حالة التحويل ──
      const [result] = await tx
        .update(stockTransfersTable)
        .set({
          status: 'received',
          received_by: userId,
          received_at: new Date(),
        })
        .where(
          and(
            eq(stockTransfersTable.id, transferId),
            eq(stockTransfersTable.company_id, companyId),
            eq(stockTransfersTable.status, 'shipped')
          )
        )
        .returning();

      if (!result) throw httpError(409, 'فشل تحديث الحالة — ربما تغيرت الحالة للتو');
      return result;
    });

    // إشعار الشاحن بأن البضاعة وصلت
    const notifyId = updated.shipped_by ?? updated.approved_by ?? updated.created_by;
    if (notifyId) {
      notify(
        companyId,
        notifyId,
        'transfer_received',
        'تم استلام التحويل ✅',
        `${updated.product_name} (${updated.quantity} وحدة) — تم الاستلام بنجاح`,
        updated.id
      );
    }

    res.json({
      ...formatTransfer(updated),
      message: 'تم استلام التحويل وإضافة المخزون لفرع الوجهة',
    });
  })
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 5. POST /api/transfers/cancel/:id — إلغاء الطلب
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.post(
  '/transfers/cancel/:id',
  wrap(async (req, res) => {
    const companyId = getTenant(req);
    const transferId = Number(req.params.id);

    if (isNaN(transferId)) throw httpError(400, 'معرّف التحويل غير صالح');

    const [transfer] = await db
      .select()
      .from(stockTransfersTable)
      .where(
        and(eq(stockTransfersTable.id, transferId), eq(stockTransfersTable.company_id, companyId))
      );

    if (!transfer) throw httpError(404, 'طلب التحويل غير موجود');

    const cancellableStatuses = ['pending', 'approved'];
    if (!cancellableStatuses.includes(transfer.status)) {
      throw httpError(
        409,
        `لا يمكن إلغاء تحويل بحالة "${transfer.status}" — يمكن الإلغاء فقط في مرحلة pending أو approved`
      );
    }

    const [updated] = await db
      .update(stockTransfersTable)
      .set({ status: 'cancelled' })
      .where(
        and(eq(stockTransfersTable.id, transferId), eq(stockTransfersTable.company_id, companyId))
      )
      .returning();

    if (!updated) {
      throw httpError(404, 'لم يتم العثور على طلب التحويل أو تعذّر التحديث');
    }
    res.json({ ...formatTransfer(updated), message: 'تم إلغاء طلب التحويل' });
  })
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 6. GET /api/transfers — قائمة التحويلات
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get(
  '/transfers',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_view_inventory')) {
      throw httpError(403, 'ليس لديك صلاحية عرض التحويلات');
    }

    const companyId = getTenant(req);
    const { status, branch_id } = req.query as Record<string, string | undefined>;

    const rawLimit = parseInt(String(req.query.limit ?? '200'), 10);
    const limit = Math.min(Math.max(isNaN(rawLimit) ? 200 : rawLimit, 1), 1000);

    // ── بناء شرط WHERE ──
    const conditions = [eq(stockTransfersTable.company_id, companyId)];

    if (status) {
      const allowed = ['pending', 'approved', 'shipped', 'received', 'cancelled'];
      if (!allowed.includes(status)) throw httpError(400, `قيمة status غير صالحة: ${status}`);
      conditions.push(eq(stockTransfersTable.status, status));
    }

    if (branch_id) {
      const bid = Number(branch_id);
      if (isNaN(bid)) throw httpError(400, 'branch_id غير صالح');
      conditions.push(
        or(eq(stockTransfersTable.from_branch_id, bid), eq(stockTransfersTable.to_branch_id, bid))!
      );
    }

    const transfers = await db
      .select()
      .from(stockTransfersTable)
      .where(and(...conditions))
      .orderBy(desc(stockTransfersTable.created_at))
      .limit(limit);

    res.json(transfers.map(formatTransfer));
  })
);

// ── GET /api/transfers/:id — تفاصيل تحويل واحد ──────────────────────────────
router.get(
  '/transfers/:id',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_view_inventory')) {
      throw httpError(403, 'ليس لديك صلاحية عرض التحويل');
    }

    const companyId = getTenant(req);
    const transferId = Number(req.params.id);

    if (isNaN(transferId)) throw httpError(400, 'معرّف التحويل غير صالح');

    const [transfer] = await db
      .select()
      .from(stockTransfersTable)
      .where(
        and(eq(stockTransfersTable.id, transferId), eq(stockTransfersTable.company_id, companyId))
      );

    if (!transfer) throw httpError(404, 'طلب التحويل غير موجود');

    res.json(formatTransfer(transfer));
  })
);

export default router;
