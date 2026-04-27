/**
 * safe-transfer.service.ts
 *
 * Service layer for safe-to-safe (cash register) transfers.
 * The route layer (routes/safe-transfers.ts) only handles HTTP parsing and
 * role checks; all business logic lives here to keep it testable and DRY.
 *
 * ── Business Rules ────────────────────────────────────────────────────────
 *  1. Only admin/manager role can initiate transfers (enforced in the route).
 *  2. Source and destination safe must belong to the same company (cross-tenant
 *     safety check performed before the transaction starts).
 *  3. A transfer cannot be made from a safe to itself.
 *  4. The source safe must have sufficient balance — the DB update uses a
 *     conditional WHERE clause so the update returns 0 rows on insufficient
 *     funds rather than going negative.
 *  5. Transfers may carry a fee (fixed EGP amount or percentage of the gross).
 *     The destination safe receives the NET amount (gross − fee).
 *     The fee is recorded as an expense in the `expenses` table and as an
 *     outgoing transaction in `transactions`.
 *  6. All DB mutations happen inside a single PostgreSQL transaction with
 *     SELECT FOR UPDATE row locks to prevent race conditions and deadlocks.
 *     Locks are always acquired in ascending safe.id order (smaller id first)
 *     regardless of transfer direction — this prevents the classic AB/BA
 *     deadlock pattern.
 *  7. Three audit log entries are written (fire-and-forget):
 *     - SAFE_TRANSFER_CREATED  — before the DB transaction starts
 *     - SAFE_TRANSFER_COMPLETED — after successful commit
 *     - SAFE_TRANSFER_FEE_APPLIED — if a fee > 0 was charged
 *
 * ── Data Flow ─────────────────────────────────────────────────────────────
 *  POST /api/safe-transfers
 *    → calculateTransferFee()   (pure, no DB)
 *    → validateTransferInput()  (pure, no DB)
 *    → executeSafeTransfer()    (orchestrator)
 *        → pre-flight safe ownership check (outside tx)
 *        → db.transaction()
 *            → applySafeTransfer()       (locks rows, mutates balances, inserts records)
 *            → createTransferExpense()   (inserts fee expense + fee transaction)
 *        → audit logs (after commit)
 */

import { and, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  safesTable,
  safeTransfersTable,
  expensesTable,
  transactionsTable,
} from "@workspace/db";
import { httpError } from "../lib/async-handler";
import { writeAuditLog } from "../lib/audit-log";
import type { AuthUser } from "../middleware/auth";

/* ─── Types ────────────────────────────────────────────────────────────── */

/** Fee calculation method for a transfer */
export type FeeType = "none" | "fixed" | "percentage";

/** Input required to execute a transfer */
export interface TransferInput {
  from_safe_id: number;
  to_safe_id:   number;
  amount:       number;    // Gross amount to debit from source safe
  fee_type:     FeeType;
  fee_rate:     number;    // EGP amount if "fixed", or percentage (0–100) if "percentage"
  notes?:       string;
  date:         string;    // YYYY-MM-DD — must be within an open fiscal period
  company_id:   number;
  user:         AuthUser;
}

/** Result of calculateTransferFee() */
export interface FeeCalculation {
  fee_amount: number;  // Calculated fee in EGP (0 if fee_type = "none")
  net_amount: number;  // Amount the destination safe will receive (gross − fee)
}

/** Response returned to the HTTP client */
export interface TransferResult {
  transfer_ref: string;  // e.g. "TRF-1714044000000"
  from:         string;  // Source safe name
  to:           string;  // Destination safe name
  amount:       number;
  fee_type:     FeeType;
  fee_amount:   number;
  net_amount:   number;
}

/* ─── 1. Pure fee calculation — no DB, fully testable ──────────────────── */

/**
 * يحسب قيمة الرسوم والمبلغ الصافي للتحويل.
 * دالة نقية لا تُعدِّل أي حالة — آمنة الاستدعاء من أي مكان.
 * @param {number} amount - المبلغ الإجمالي للتحويل بالجنيه المصري
 * @param {FeeType} fee_type - نوع الرسوم: "none" بلا رسوم، "fixed" ثابتة، "percentage" نسبة مئوية
 * @param {number} fee_rate - قيمة الرسوم: مبلغ ثابت إذا "fixed"، أو نسبة (مثل 2.5 تعني 2.5%) إذا "percentage"
 * @returns {FeeCalculation} - كائن يحتوي على `fee_amount` و`net_amount` مقرَّبَين لخانتين عشريتين
 */
export function calculateTransferFee(
  amount:   number,
  fee_type: FeeType,
  fee_rate: number,
): FeeCalculation {
  let fee_amount = 0;

  if (fee_type === "fixed") {
    // Fixed fee: deduct a flat EGP amount
    fee_amount = fee_rate;
  } else if (fee_type === "percentage") {
    // Percentage fee: e.g. fee_rate=2.5 means 2.5% of the gross amount
    fee_amount = (amount * fee_rate) / 100;
  }

  // Round to 2 decimal places and clamp to 0 (fee cannot be negative)
  fee_amount = Math.max(0, Math.round(fee_amount * 100) / 100);
  const net_amount = Math.round((amount - fee_amount) * 100) / 100;

  return { fee_amount, net_amount };
}

/* ─── 2. Input validation ───────────────────────────────────────────────── */

export interface ValidationError { field: string; message: string }

/**
 * يتحقق من صحة معاملات التحويل قبل أي استعلام على قاعدة البيانات.
 * يُرجع أول خطأ يُعثر عليه، أو null إذا كانت جميع المعاملات صحيحة.
 * @param {object} data - بيانات التحويل المراد التحقق منها
 * @param {number} data.amount - المبلغ الإجمالي
 * @param {number} data.from_safe_id - معرّف خزينة المصدر
 * @param {number} data.to_safe_id - معرّف خزينة الوجهة
 * @param {number} data.fee_rate - قيمة معدل الرسوم
 * @param {number} data.net_amount - المبلغ الصافي (الإجمالي مطروحاً منه الرسوم)
 * @returns {ValidationError | null} - كائن الخطأ مع اسم الحقل ورسالة عربية، أو null إذا لا أخطاء
 */
export function validateTransferInput(data: {
  amount:       number;
  from_safe_id: number;
  to_safe_id:   number;
  fee_rate:     number;
  net_amount:   number;
}): ValidationError | null {
  if (!data.from_safe_id || !data.to_safe_id)
    return { field: "safe_id", message: "يجب اختيار الخزينتين" };

  // Cannot transfer a safe to itself
  if (data.from_safe_id === data.to_safe_id)
    return { field: "to_safe_id", message: "لا يمكن التحويل من وإلى نفس الخزينة" };

  if (isNaN(data.amount) || data.amount <= 0)
    return { field: "amount", message: "المبلغ يجب أن يكون أكبر من الصفر" };

  if (data.fee_rate < 0)
    return { field: "fee_rate", message: "قيمة الرسوم لا يمكن أن تكون سالبة" };

  // Fee cannot exceed the transfer amount (net would go negative)
  if (data.net_amount < 0)
    return { field: "net_amount", message: "الرسوم أكبر من المبلغ — الصافي لا يمكن أن يكون سالباً" };

  return null;
}

/* ─── 3. Core transfer within an existing transaction ─────────────────── */

type AnyTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

interface LockedSafe { id: number; name: string; balance: string }

/**
 * يُنفِّذ تعديلات الأرصدة وإدراج السجلات داخل معاملة قاعدة بيانات قائمة.
 * يُستدعى فقط من `executeSafeTransfer()` — لا تستدعِه مباشرةً.
 *
 * استراتيجية القفل:
 *   يتم قفل صفوف الخزائن بـ SELECT FOR UPDATE بترتيب تصاعدي حسب الـ id،
 *   بصرف النظر عن اتجاه التحويل، لمنع حالة الإغلاق المتبادل (Deadlock)
 *   حين يحاول تحويلان متزامنان قفل نفس الصفوف بترتيب معكوس.
 *
 * فحص الرصيد:
 *   أمر UPDATE يتضمن `WHERE balance >= amount`؛ إذا كان الرصيد غير كافٍ
 *   تُعاد 0 صفوف ويُلقى خطأ 400 داخل المعاملة مما يُتراجع عن جميع التعديلات.
 * @param {AnyTx} tx - كائن معاملة Drizzle الجارية
 * @param {object} opts - خيارات التحويل (المعرّفات والمبالغ والتاريخ ومرجع التحويل)
 * @returns {Promise<{ transferId: number; fromSafe: LockedSafe; toSafe: LockedSafe }>} - معرّف التحويل المُنشأ وبيانات الخزينتين
 */
export async function applySafeTransfer(
  tx: AnyTx,
  opts: {
    fromId:     number;
    toId:       number;
    amount:     number;   // Gross amount debited from source
    netAmount:  number;   // Net amount credited to destination (gross − fee)
    feeAmount:  number;
    feeType:    FeeType;
    feeRate:    number;
    notes?:     string;
    txDate:     string;
    transferRef:string;
    companyId:  number;
  },
): Promise<{ transferId: number; fromSafe: LockedSafe; toSafe: LockedSafe }> {
  const { fromId, toId, amount, netAmount, feeAmount, feeType, feeRate,
          notes, txDate, transferRef, companyId } = opts;

  // Lock both safe rows in ascending ID order to prevent deadlocks
  const [first, second] = fromId < toId ? [fromId, toId] : [toId, fromId];
  const lockRes = await tx.execute(sql`
    SELECT id, name, balance FROM ${safesTable}
    WHERE id IN (${first}, ${second}) AND company_id = ${companyId}
    ORDER BY id
    FOR UPDATE
  `);

  const rows = (
    (lockRes as unknown as { rows?: LockedSafe[] }).rows ??
    (lockRes as unknown as LockedSafe[])
  );
  const fromSafe = rows.find(r => r.id === fromId);
  const toSafe   = rows.find(r => r.id === toId);
  if (!fromSafe) throw httpError(400, "خزينة المصدر غير موجودة أو لا تنتمي لشركتك");
  if (!toSafe)   throw httpError(400, "خزينة الوجهة غير موجودة أو لا تنتمي لشركتك");

  // Debit the FULL gross amount from the source safe.
  // The WHERE balance >= amount prevents overdrafts — if this returns 0 rows,
  // the safe did not have enough balance and we throw a descriptive error.
  const debited = await tx.update(safesTable)
    .set({ balance: sql`${safesTable.balance} - ${String(amount)}` })
    .where(and(
      eq(safesTable.id, fromSafe.id),
      eq(safesTable.company_id, companyId),
      sql`${safesTable.balance} >= ${String(amount)}`,
    ))
    .returning();

  if (!debited[0]) {
    throw httpError(
      400,
      `رصيد خزينة "${fromSafe.name}" غير كافٍ (${Number(fromSafe.balance).toFixed(2)} ج.م)`,
    );
  }

  // Credit only the NET amount to the destination safe (gross − fee)
  await tx.update(safesTable)
    .set({ balance: sql`${safesTable.balance} + ${String(netAmount)}` })
    .where(and(eq(safesTable.id, toSafe.id), eq(safesTable.company_id, companyId)));

  // Sanity check: confirm net_amount matches our expected calculation
  // This catches any floating-point drift or logic errors before persisting
  const expectedNet = Math.round((amount - feeAmount) * 100) / 100;
  if (Math.abs(expectedNet - netAmount) > 0.001) {
    throw httpError(500, "خطأ في حساب الرسوم — الصافي لا يتطابق مع المبلغ مطروحاً منه الرسوم");
  }

  // Insert the transfer record
  const [transfer] = await tx.insert(safeTransfersTable).values({
    from_safe_id:   fromSafe.id,
    from_safe_name: fromSafe.name,
    to_safe_id:     toSafe.id,
    to_safe_name:   toSafe.name,
    amount:         String(amount),
    fee_type:       feeType,
    fee_rate:       String(feeRate),
    fee_amount:     String(feeAmount),
    net_amount:     String(netAmount),
    notes:          notes ?? null,
    company_id:     companyId,
  }).returning({ id: safeTransfersTable.id });

  const transferId = transfer.id;

  // Insert two transaction records: one outgoing (source) and one incoming (destination)
  // These appear in the cash flow / transaction ledger for each safe
  await tx.insert(transactionsTable).values([
    {
      type:           "transfer_out",
      reference_type: "safe_transfer",
      safe_id:        fromSafe.id,
      safe_name:      fromSafe.name,
      amount:         String(amount),
      direction:      "out",
      description:    `تحويل ${transferRef} → ${toSafe.name}${notes ? ` (${notes})` : ""}`,
      date:           txDate,
      company_id:     companyId,
    },
    {
      type:           "transfer_in",
      reference_type: "safe_transfer",
      safe_id:        toSafe.id,
      safe_name:      toSafe.name,
      amount:         String(netAmount),  // Net amount (after fee deduction)
      direction:      "in",
      description:    `تحويل ${transferRef} ← ${fromSafe.name}${notes ? ` (${notes})` : ""}`,
      date:           txDate,
      company_id:     companyId,
    },
  ]);

  return { transferId, fromSafe, toSafe };
}

/* ─── 4. Create transfer fee expense ───────────────────────────────────── */

/**
 * يُسجِّل رسوم التحويل كمصروف للشركة إذا كانت الرسوم أكبر من صفر.
 * يُسجِّل أيضاً حركة خروج في سجل معاملات خزينة المصدر
 * حتى تظهر الرسوم في كشف حساب الخزينة.
 * يُستدعى ضمن نفس معاملة `applySafeTransfer` لضمان الذرية التامة.
 * @param {AnyTx} tx - كائن معاملة Drizzle الجارية
 * @param {object} opts - خيارات الرسوم (المبلغ، معرّف المصدر واسمه، مرجع التحويل، التاريخ، ومعرّف الشركة)
 * @returns {Promise<void>} - لا تُرجع قيمة (لا شيء إذا كانت الرسوم صفراً)
 */
export async function createTransferExpense(
  tx: AnyTx,
  opts: {
    feeAmount:   number;
    fromSafeId:  number;
    fromSafeName:string;
    transferId:  number;
    transferRef: string;
    toSafeName:  string;
    txDate:      string;
    companyId:   number;
  },
): Promise<void> {
  // No-op if there's no fee — avoids cluttering the expense list with zero-value entries
  if (opts.feeAmount <= 0) return;

  const { feeAmount, fromSafeId, fromSafeName, transferId,
          transferRef, toSafeName, txDate, companyId } = opts;

  // Record the fee as an expense (category: "رسوم تحويل" = Transfer Fee)
  await tx.insert(expensesTable).values({
    category:       "رسوم تحويل",
    amount:         String(feeAmount),
    description:    `رسوم تحويل ${transferRef} من ${fromSafeName} إلى ${toSafeName}`,
    safe_id:        fromSafeId,
    safe_name:      fromSafeName,
    reference_type: "safe_transfer",
    reference_id:   transferId,
    company_id:     companyId,
  });

  // Also record it as an outgoing transaction for the source safe's cash flow ledger
  await tx.insert(transactionsTable).values({
    type:           "expense",
    reference_type: "safe_transfer_fee",
    safe_id:        fromSafeId,
    safe_name:      fromSafeName,
    amount:         String(feeAmount),
    direction:      "out",
    description:    `رسوم تحويل ${transferRef}`,
    date:           txDate,
    company_id:     companyId,
  });
}

/* ─── 5. Main orchestrator ──────────────────────────────────────────────── */

/**
 * نقطة الدخول الرئيسية لإنشاء تحويل بين خزينتين.
 * تنسِّق هذه الدالة التحقق من المدخلات، ومعاملة قاعدة البيانات، وسجلات التدقيق.
 *
 * ترتيب التنفيذ:
 *  1. حساب الرسوم والمبلغ الصافي (بدون قاعدة بيانات)
 *  2. التحقق المسبق من ملكية الخزينتين قبل فتح المعاملة (رفض مبكر وسريع)
 *  3. كتابة سجل تدقيق "SAFE_TRANSFER_CREATED" (إطلاق وانسَ)
 *  4. فتح معاملة قاعدة بيانات واحدة تشمل:
 *     أ. قفل صفوف الخزينتين لمنع تلوُّث الأرصدة المتزامن
 *     ب. خصم المبلغ الإجمالي من خزينة المصدر
 *     ج. إضافة المبلغ الصافي إلى خزينة الوجهة
 *     د. إدراج سجل التحويل في جدول safe_transfers
 *     هـ. إدراج حركتَي معاملة (خروج + دخول) في جدول transactions
 *     و. إدراج مصروف الرسوم (إن وُجد) في جدول expenses
 *  5. بعد التثبيت: كتابة سجلَي تدقيق "COMPLETED" و"FEE_APPLIED"
 *
 * في حال فشل أي خطوة داخل المعاملة، تُتراجع PostgreSQL عن كل شيء ذرياً.
 * @param {TransferInput} input - بيانات التحويل الكاملة
 * @returns {Promise<TransferResult>} - نتيجة التحويل الناجح مع المرجع والمبالغ
 */
export async function executeSafeTransfer(input: TransferInput): Promise<TransferResult> {
  const { from_safe_id, to_safe_id, amount, fee_type, fee_rate,
          notes, date, company_id, user } = input;

  // Step 1: Calculate fee amounts before any DB work
  const { fee_amount, net_amount } = calculateTransferFee(amount, fee_type, fee_rate);

  // Step 2: Pre-flight — verify both safes exist and belong to this company
  // This is done outside the transaction to give a clear error message early,
  // before acquiring any locks.
  const precheckSafes = await db
    .select({ id: safesTable.id, company_id: safesTable.company_id })
    .from(safesTable)
    .where(inArray(safesTable.id, [from_safe_id, to_safe_id]));

  const checkFrom = precheckSafes.find(s => s.id === from_safe_id);
  const checkTo   = precheckSafes.find(s => s.id === to_safe_id);
  if (!checkFrom || checkFrom.company_id !== company_id)
    throw httpError(403, "لا يمكن التحويل بين خزائن شركات مختلفة");
  if (!checkTo || checkTo.company_id !== company_id)
    throw httpError(403, "لا يمكن التحويل بين خزائن شركات مختلفة");

  // Step 3: Generate a unique transfer reference (used in descriptions and audit logs)
  const transferRef = `TRF-${Date.now()}`;

  // Audit: record transfer initiation before the DB transaction
  void writeAuditLog({
    action:      "SAFE_TRANSFER_CREATED",
    record_type: "safe_transfer",
    record_id:   0,
    new_value:   { from_safe_id, to_safe_id, amount, fee_type, fee_amount, net_amount },
    user:        { id: user.id, username: user.username },
    company_id,
    note:        transferRef,
  });

  // Step 4: Execute everything inside a single atomic DB transaction
  const result = await db.transaction(async tx => {
    const { transferId, fromSafe, toSafe } = await applySafeTransfer(tx, {
      fromId:      from_safe_id,
      toId:        to_safe_id,
      amount,
      netAmount:   net_amount,
      feeAmount:   fee_amount,
      feeType:     fee_type,
      feeRate:     fee_rate,
      notes,
      txDate:      date,
      transferRef,
      companyId:   company_id,
    });

    // Record the fee as an expense (no-op if fee_amount = 0)
    await createTransferExpense(tx, {
      feeAmount:    fee_amount,
      fromSafeId:   fromSafe.id,
      fromSafeName: fromSafe.name,
      transferId,
      transferRef,
      toSafeName:   toSafe.name,
      txDate:       date,
      companyId:    company_id,
    });

    return { transferId, fromSafe, toSafe };
  });

  // Step 5: Audit logs written after successful commit (fire-and-forget)
  void writeAuditLog({
    action:      "SAFE_TRANSFER_COMPLETED",
    record_type: "safe_transfer",
    record_id:   result.transferId,
    new_value:   {
      from:       result.fromSafe.name,
      to:         result.toSafe.name,
      amount,
      fee_amount,
      net_amount,
    },
    user:    { id: user.id, username: user.username },
    company_id,
    note:    transferRef,
  });

  // Separate fee audit entry for easier filtering in the audit log viewer
  if (fee_amount > 0) {
    void writeAuditLog({
      action:      "SAFE_TRANSFER_FEE_APPLIED",
      record_type: "safe_transfer",
      record_id:   result.transferId,
      new_value:   { fee_type, fee_rate, fee_amount, old_balance: Number(result.fromSafe.balance) },
      user:        { id: user.id, username: user.username },
      company_id,
      note:        transferRef,
    });
  }

  return {
    transfer_ref: transferRef,
    from:         result.fromSafe.name,
    to:           result.toSafe.name,
    amount,
    fee_type,
    fee_amount,
    net_amount,
  };
}
