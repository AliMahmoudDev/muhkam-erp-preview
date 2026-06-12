import { Router } from 'express';
import { eq, desc, or, count, and } from 'drizzle-orm';
import { db } from '@workspace/db';
import { authenticate, requireRole, requireTenantStrict, getTenant } from '../../middleware/auth';
import { z } from 'zod/v4';
import { firstZodError } from '../../lib/schemas';
import { wrap } from '../../lib/async-handler';
import {
  safesTable,
  safeTransfersTable,
  salesTable,
  expensesTable,
  incomeTable,
  transactionsTable,
  receiptVouchersTable,
  depositVouchersTable,
  paymentVouchersTable,
} from '@workspace/db';

const createSafeSchema = z.object({
  name: z.string().min(1),
  balance: z.union([z.string(), z.number()]).optional().nullable(),
  branch_id: z.union([z.string(), z.number()]).optional().nullable(),
});

const updateSafeSchema = z.object({
  name: z.string().min(1).optional(),
  balance: z.union([z.string(), z.number()]).optional(),
  branch_id: z.union([z.string(), z.number()]).optional().nullable(),
});

const closeSafeSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  actual_balance: z.union([z.string(), z.number()]).optional().nullable(),
  notes: z.string().optional().nullable(),
});

const router = Router();

// ─── SAFES ────────────────────────────────────────────────────────────────────

router.get(
  '/settings/safes',
  wrap(async (req, res) => {
    const companyId = getTenant(req);
    const safes = await db
      .select()
      .from(safesTable)
      .where(eq(safesTable.company_id, companyId))
      .orderBy(safesTable.id);
    res.json(safes);
  })
);

router.post(
  '/settings/safes',
  authenticate,
  requireRole('admin'),
  wrap(async (req, res) => {
    const parsedSafe = createSafeSchema.safeParse(req.body);
    if (!parsedSafe.success) {
      res.status(400).json({ error: firstZodError(parsedSafe.error) });
      return;
    }
    const { name, balance, branch_id } = parsedSafe.data;
    const companyId = getTenant(req);
    const [safe] = await db
      .insert(safesTable)
      .values({
        name,
        balance: String(balance || 0),
        company_id: companyId,
        branch_id: branch_id ? Number(branch_id) : null,
      })
      .returning();
    res.json(safe);
  })
);

router.put(
  '/settings/safes/:id',
  authenticate,
  requireRole('admin'),
  requireTenantStrict,
  wrap(async (req, res) => {
    const parsedSafeU = updateSafeSchema.safeParse(req.body);
    if (!parsedSafeU.success) {
      res.status(400).json({ error: firstZodError(parsedSafeU.error) });
      return;
    }
    const id = Number(req.params.id);
    const tenant = getTenant(req);
    const { name, balance, branch_id } = parsedSafeU.data;
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = String(name).trim();
    if (balance !== undefined) updates.balance = String(balance);
    if (branch_id !== undefined) updates.branch_id = branch_id ? Number(branch_id) : null;
    const [safe] = await db
      .update(safesTable)
      .set(updates)
      .where(and(eq(safesTable.id, id), eq(safesTable.company_id, tenant)))
      .returning();
    if (!safe) {
      res.status(404).json({ error: 'الخزينة غير موجودة' });
      return;
    }
    res.json(safe);
  })
);

router.delete(
  '/settings/safes/:id',
  authenticate,
  requireRole('admin'),
  requireTenantStrict,
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    const tenant = getTenant(req);
    const [safe] = await db
      .select()
      .from(safesTable)
      .where(and(eq(safesTable.id, id), eq(safesTable.company_id, tenant)));
    if (!safe) {
      res.status(404).json({ error: 'الخزينة غير موجودة' });
      return;
    }

    if (Number(safe.balance) !== 0) {
      res
        .status(409)
        .json({ error: 'لا يمكن حذف خزينة تحتوي على رصيد — يجب أن يكون الرصيد صفراً أولاً' });
      return;
    }

    const [[expenses], [income], [receipts], [payments], [deposits], [transfers], [sales], [txn]] =
      await Promise.all([
        db
          .select({ n: count() })
          .from(expensesTable)
          .where(and(eq(expensesTable.safe_id, id), eq(expensesTable.company_id, tenant))),
        db
          .select({ n: count() })
          .from(incomeTable)
          .where(and(eq(incomeTable.safe_id, id), eq(incomeTable.company_id, tenant))),
        db
          .select({ n: count() })
          .from(receiptVouchersTable)
          .where(
            and(eq(receiptVouchersTable.safe_id, id), eq(receiptVouchersTable.company_id, tenant))
          ),
        db
          .select({ n: count() })
          .from(paymentVouchersTable)
          .where(
            and(eq(paymentVouchersTable.safe_id, id), eq(paymentVouchersTable.company_id, tenant))
          ),
        db
          .select({ n: count() })
          .from(depositVouchersTable)
          .where(
            and(eq(depositVouchersTable.safe_id, id), eq(depositVouchersTable.company_id, tenant))
          ),
        db
          .select({ n: count() })
          .from(safeTransfersTable)
          .where(
            and(
              eq(safeTransfersTable.company_id, tenant),
              or(eq(safeTransfersTable.from_safe_id, id), eq(safeTransfersTable.to_safe_id, id))
            )
          ),
        db
          .select({ n: count() })
          .from(salesTable)
          .where(and(eq(salesTable.safe_id, id), eq(salesTable.company_id, tenant))),
        db
          .select({ n: count() })
          .from(transactionsTable)
          .where(and(eq(transactionsTable.safe_id, id), eq(transactionsTable.company_id, tenant))),
      ]);

    const hasMovements =
      Number(expenses.n) > 0 ||
      Number(income.n) > 0 ||
      Number(receipts.n) > 0 ||
      Number(payments.n) > 0 ||
      Number(deposits.n) > 0 ||
      Number(transfers.n) > 0 ||
      Number(sales.n) > 0 ||
      Number(txn.n) > 0;

    if (hasMovements) {
      res.status(409).json({ error: 'لا يمكن حذف خزينة لها حركات مالية مسجّلة' });
      return;
    }

    await db
      .delete(safesTable)
      .where(and(eq(safesTable.id, id), eq(safesTable.company_id, tenant)));
    res.json({ success: true });
  })
);

/* Closing a safe creates financial adjustment transactions. Restrict to
   admin role to prevent any authenticated tenant user from mutating
   treasury balances. */
router.post(
  '/settings/safes/:id/close',
  authenticate,
  requireRole('admin'),
  requireTenantStrict,
  wrap(async (req, res) => {
    const parsedClose = closeSafeSchema.safeParse(req.body);
    if (!parsedClose.success) {
      res.status(400).json({ error: firstZodError(parsedClose.error) });
      return;
    }
    const id = Number(req.params.id);
    const tenant = getTenant(req);
    const { date, actual_balance, notes } = parsedClose.data;
    const closeDate = date ?? new Date().toISOString().split('T')[0];

    const [safe] = await db
      .select()
      .from(safesTable)
      .where(and(eq(safesTable.id, id), eq(safesTable.company_id, tenant)));
    if (!safe) {
      res.status(404).json({ error: 'الخزينة غير موجودة' });
      return;
    }

    const systemBalance = Number(safe.balance);
    const closing_no = `CLO-${id}-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`;

    const todayTx = await db
      .select()
      .from(transactionsTable)
      .where(and(eq(transactionsTable.safe_id, id), eq(transactionsTable.company_id, tenant)))
      .orderBy(desc(transactionsTable.created_at));

    const dayTx = todayTx.filter((t) => (t.date ?? '') === closeDate);
    const totalIn = dayTx
      .filter((t) => t.direction === 'in')
      .reduce((s, t) => s + Number(t.amount), 0);
    const totalOut = dayTx
      .filter((t) => t.direction === 'out')
      .reduce((s, t) => s + Number(t.amount), 0);

    let difference = 0;
    let adjustmentNote = null;
    if (actual_balance !== undefined && actual_balance !== null) {
      const actualBal = Number(actual_balance);
      difference = actualBal - systemBalance;
      if (Math.abs(difference) > 0.001) {
        adjustmentNote =
          difference > 0
            ? `زيادة خزينة ${difference.toFixed(2)} — تم التسجيل في إقفال ${closing_no}`
            : `عجز خزينة ${Math.abs(difference).toFixed(2)} — تم التسجيل في إقفال ${closing_no}`;

        await db.insert(transactionsTable).values({
          type: 'safe_adjustment',
          reference_type: 'safe_closing',
          safe_id: id,
          safe_name: safe.name,
          amount: String(Math.abs(difference)),
          direction: difference > 0 ? 'in' : 'out',
          description: adjustmentNote,
          date: closeDate,
          company_id: tenant,
        });

        await db
          .update(safesTable)
          .set({ balance: String(Number(actual_balance)) })
          .where(and(eq(safesTable.id, id), eq(safesTable.company_id, tenant)));
      }
    }

    await db.insert(transactionsTable).values({
      type: 'safe_closing',
      reference_type: 'safe_closing',
      safe_id: id,
      safe_name: safe.name,
      amount: String(actual_balance !== undefined ? Number(actual_balance) : systemBalance),
      direction: 'in',
      description: notes
        ? `${notes} — إقفال ${closing_no}`
        : `إقفال خزينة ${safe.name} — ${closeDate}`,
      date: closeDate,
      company_id: tenant,
    });

    res.json({
      success: true,
      closing_no,
      safe_id: id,
      safe_name: safe.name,
      date: closeDate,
      system_balance: systemBalance,
      actual_balance: actual_balance !== undefined ? Number(actual_balance) : systemBalance,
      difference: Math.round(difference * 100) / 100,
      adjustment_note: adjustmentNote,
      summary: {
        total_in: Math.round(totalIn * 100) / 100,
        total_out: Math.round(totalOut * 100) / 100,
        net: Math.round((totalIn - totalOut) * 100) / 100,
        transaction_count: dayTx.length,
      },
    });
  })
);

router.get(
  '/settings/safes/:id/statement',
  authenticate,
  requireTenantStrict,
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    const tenant = getTenant(req);
    const { date_from, date_to } = req.query as { date_from?: string; date_to?: string };

    const [safe] = await db
      .select()
      .from(safesTable)
      .where(and(eq(safesTable.id, id), eq(safesTable.company_id, tenant)));
    if (!safe) {
      res.status(404).json({ error: 'الخزينة غير موجودة' });
      return;
    }

    let txList = await db
      .select()
      .from(transactionsTable)
      .where(and(eq(transactionsTable.safe_id, id), eq(transactionsTable.company_id, tenant)))
      .orderBy(transactionsTable.date, transactionsTable.created_at);

    if (date_from) txList = txList.filter((t) => (t.date ?? '') >= date_from);
    if (date_to) txList = txList.filter((t) => (t.date ?? '') <= date_to);

    let running = 0;
    const rows = txList.map((t) => {
      const amt = Number(t.amount);
      running += t.direction === 'in' ? amt : -amt;
      return {
        id: t.id,
        type: t.type,
        direction: t.direction,
        amount: amt,
        balance_after: Math.round(running * 100) / 100,
        description: t.description,
        date: t.date,
        created_at: t.created_at?.toISOString(),
      };
    });

    const totalIn = txList
      .filter((t) => t.direction === 'in')
      .reduce((s, t) => s + Number(t.amount), 0);
    const totalOut = txList
      .filter((t) => t.direction === 'out')
      .reduce((s, t) => s + Number(t.amount), 0);

    res.json({
      safe_id: id,
      safe_name: safe.name,
      current_balance: Number(safe.balance),
      total_in: Math.round(totalIn * 100) / 100,
      total_out: Math.round(totalOut * 100) / 100,
      net: Math.round((totalIn - totalOut) * 100) / 100,
      rows,
    });
  })
);

export default router;
