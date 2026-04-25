/**
 * safe-transfer.service.ts
 *
 * Service layer for safe-to-safe transfers.
 * The route only handles HTTP parsing; all business logic lives here.
 * This keeps the code DRY and makes unit-testing straightforward.
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

export type FeeType = "none" | "fixed" | "percentage";

export interface TransferInput {
  from_safe_id: number;
  to_safe_id:   number;
  amount:       number;
  fee_type:     FeeType;
  fee_rate:     number;
  notes?:       string;
  date:         string;
  company_id:   number;
  user:         AuthUser;
}

export interface FeeCalculation {
  fee_amount: number;
  net_amount: number;
}

export interface TransferResult {
  transfer_ref: string;
  from:         string;
  to:           string;
  amount:       number;
  fee_type:     FeeType;
  fee_amount:   number;
  net_amount:   number;
}

/* ─── 1. Pure fee calculation — no DB, fully testable ──────────────────── */

export function calculateTransferFee(
  amount:   number,
  fee_type: FeeType,
  fee_rate: number,
): FeeCalculation {
  let fee_amount = 0;

  if (fee_type === "fixed") {
    fee_amount = fee_rate;
  } else if (fee_type === "percentage") {
    fee_amount = (amount * fee_rate) / 100;
  }

  fee_amount = Math.max(0, Math.round(fee_amount * 100) / 100);
  const net_amount = Math.round((amount - fee_amount) * 100) / 100;

  return { fee_amount, net_amount };
}

/* ─── 2. Input validation ───────────────────────────────────────────────── */

export interface ValidationError { field: string; message: string }

export function validateTransferInput(data: {
  amount:       number;
  from_safe_id: number;
  to_safe_id:   number;
  fee_rate:     number;
  net_amount:   number;
}): ValidationError | null {
  if (!data.from_safe_id || !data.to_safe_id)
    return { field: "safe_id", message: "يجب اختيار الخزينتين" };

  if (data.from_safe_id === data.to_safe_id)
    return { field: "to_safe_id", message: "لا يمكن التحويل من وإلى نفس الخزينة" };

  if (isNaN(data.amount) || data.amount <= 0)
    return { field: "amount", message: "المبلغ يجب أن يكون أكبر من الصفر" };

  if (data.fee_rate < 0)
    return { field: "fee_rate", message: "قيمة الرسوم لا يمكن أن تكون سالبة" };

  if (data.net_amount < 0)
    return { field: "net_amount", message: "الرسوم أكبر من المبلغ — الصافي لا يمكن أن يكون سالباً" };

  return null;
}

/* ─── 3. Core transfer within an existing transaction ─────────────────── */

type AnyTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

interface LockedSafe { id: number; name: string; balance: string }

export async function applySafeTransfer(
  tx: AnyTx,
  opts: {
    fromId:     number;
    toId:       number;
    amount:     number;
    netAmount:  number;
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

  // قفل الصفّين بترتيب الـ id الأصغر أولاً لمنع الـ deadlock
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

  // خصم المبلغ الكامل من المصدر مع شرط كفاية الرصيد
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

  // إضافة الصافي فقط للوجهة
  await tx.update(safesTable)
    .set({ balance: sql`${safesTable.balance} + ${String(netAmount)}` })
    .where(and(eq(safesTable.id, toSafe.id), eq(safesTable.company_id, companyId)));

  // ── تحقق من الاتساق قبل الكتابة ────────────────────────────
  const expectedNet = Math.round((amount - feeAmount) * 100) / 100;
  if (Math.abs(expectedNet - netAmount) > 0.001) {
    throw httpError(500, "خطأ في حساب الرسوم — الصافي لا يتطابق مع المبلغ مطروحاً منه الرسوم");
  }

  // ── سجل التحويل ─────────────────────────────────────────────
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

  // ── سجلات المعاملات المالية ─────────────────────────────────
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
      amount:         String(netAmount),
      direction:      "in",
      description:    `تحويل ${transferRef} ← ${fromSafe.name}${notes ? ` (${notes})` : ""}`,
      date:           txDate,
      company_id:     companyId,
    },
  ]);

  return { transferId, fromSafe, toSafe };
}

/* ─── 4. Create transfer fee expense ───────────────────────────────────── */

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
  if (opts.feeAmount <= 0) return;

  const { feeAmount, fromSafeId, fromSafeName, transferId,
          transferRef, toSafeName, txDate, companyId } = opts;

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

  // سجل خروج الرسوم في transactions
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

export async function executeSafeTransfer(input: TransferInput): Promise<TransferResult> {
  const { from_safe_id, to_safe_id, amount, fee_type, fee_rate,
          notes, date, company_id, user } = input;

  const { fee_amount, net_amount } = calculateTransferFee(amount, fee_type, fee_rate);

  // Validate safe ownership (pre-flight, outside transaction)
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

  const transferRef = `TRF-${Date.now()}`;

  // Audit: transfer initiated
  void writeAuditLog({
    action:      "SAFE_TRANSFER_CREATED",
    record_type: "safe_transfer",
    record_id:   0,
    new_value:   { from_safe_id, to_safe_id, amount, fee_type, fee_amount, net_amount },
    user:        { id: user.id, username: user.username },
    company_id,
    note:        transferRef,
  });

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

  // Audit: transfer completed
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

  // Audit: fee applied (if any)
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
