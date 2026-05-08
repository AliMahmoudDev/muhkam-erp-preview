/**
 * safe-transfers route — HTTP layer only.
 * All business logic lives in services/safe-transfer.service.ts.
 */
import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, safeTransfersTable } from "@workspace/db";
import { wrap } from "../lib/async-handler";
import { assertPeriodOpen } from "../lib/period-lock";
import { getTenant } from "../middleware/auth";
import { hasPermission } from "../lib/permissions";
import {
  calculateTransferFee,
  validateTransferInput,
  executeSafeTransfer,
  type FeeType,
} from "../services/safe-transfer.service";
import { safeTransferBodySchema, firstZodError } from "../lib/schemas";

const router: IRouter = Router();

/* ─── GET /api/safe-transfers ───────────────────────────────────────────── */
router.get("/safe-transfers", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_treasury")) {
    res.status(403).json({ error: "ليس لديك صلاحية عرض الخزينة" }); return;
  }
  const companyId = getTenant(req);
  const safeLimit = Math.min(2000, Math.max(1, parseInt(String(req.query["limit"] ?? "500"), 10)));

  const items = await db
    .select()
    .from(safeTransfersTable)
    .where(eq(safeTransfersTable.company_id, companyId))
    .orderBy(desc(safeTransfersTable.created_at))
    .limit(safeLimit);

  res.json(items.map(t => ({
    ...t,
    amount:     Number(t.amount),
    fee_amount: Number(t.fee_amount ?? 0),
    fee_rate:   Number(t.fee_rate   ?? 0),
    net_amount: Number(t.net_amount ?? t.amount),
    created_at: t.created_at.toISOString(),
  })));
}));

/* ─── POST /api/safe-transfers ──────────────────────────────────────────── */
router.post("/safe-transfers", wrap(async (req, res) => {
  const userRole = req.user?.role ?? "cashier";
  if (userRole !== "admin" && userRole !== "manager") {
    res.status(403).json({ error: "ليس لديك صلاحية لتحويل الخزائن — يُسمح للمدير فقط" }); return;
  }

  const bodyResult = safeTransferBodySchema.safeParse(req.body);
  if (!bodyResult.success) {
    res.status(400).json({ error: firstZodError(bodyResult.error) }); return;
  }

  const { from_safe_id, to_safe_id, amount, notes, date, fee_type, fee_rate } = bodyResult.data;

  const txDate  = date ?? new Date().toISOString().split("T")[0];
  const feeType = fee_type as FeeType;
  const amt     = amount;
  const fromId  = from_safe_id;
  const toId    = to_safe_id;
  const feeRate = fee_rate;

  await assertPeriodOpen(txDate, req);

  const { net_amount } = calculateTransferFee(amt, feeType, feeRate);

  const validationErr = validateTransferInput({
    amount:       amt,
    from_safe_id: fromId,
    to_safe_id:   toId,
    fee_rate:     feeRate,
    net_amount,
  });
  if (validationErr) {
    res.status(400).json({ error: validationErr.message, field: validationErr.field }); return;
  }

  const companyId = getTenant(req);

  const result = await executeSafeTransfer({
    from_safe_id: fromId,
    to_safe_id:   toId,
    amount:       amt,
    fee_type:     feeType,
    fee_rate:     feeRate,
    notes:        notes ?? undefined,
    date:         txDate,
    company_id:   companyId,
    user:         req.user!,
  });

  res.status(201).json(result);
}));

export default router;
