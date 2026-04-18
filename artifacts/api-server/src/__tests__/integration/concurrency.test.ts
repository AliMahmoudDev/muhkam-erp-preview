/**
 * Concurrency & Atomic Balance Tests — Real Integration
 *
 * Rules:
 *  - Zero mocks. Real DB, real Express app via supertest.
 *  - Fire N simultaneous requests (Promise.all) and assert the final safe
 *    balance is never negative and equals exactly the expected value.
 *  - Each test uses a fresh company + safe so tests are independent.
 *  - Cleanup always runs in afterAll regardless of failures.
 */

import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { pool } from '@workspace/db';
import app from '../../app';

const JWT_SECRET = process.env.JWT_SECRET!;
const RUN_ID = Date.now();
const P = `CC_${RUN_ID}`;

/* ── Shared state ────────────────────────────────────────────────── */

let companyId: number;
let userId: number;
let token: string;

/* safe IDs created per describe block */
let safeTransferSrcId: number;
let safeTransferDstId: number;
let expenseSafeId: number;
let safeTransferSrcIdB: number;
let companyBId: number;
let userBId: number;
let tokenB: string;

/* ── Helpers ─────────────────────────────────────────────────────── */

async function getSafeBalance(safeId: number): Promise<number> {
  const r = await pool.query<{ balance: string }>(
    'SELECT balance FROM safes WHERE id = $1',
    [safeId],
  );
  return Number(r.rows[0]?.balance ?? 0);
}

async function createSafe(name: string, balance: number, cid: number): Promise<number> {
  const r = await pool.query<{ id: number }>(
    `INSERT INTO safes (name, balance, company_id) VALUES ($1, $2, $3) RETURNING id`,
    [name, String(balance), cid],
  );
  return r.rows[0].id;
}

/* ── Setup ───────────────────────────────────────────────────────── */

beforeAll(async () => {
  /* Company A */
  const coA = await pool.query<{ id: number }>(
    `INSERT INTO companies (name, plan_type, start_date, end_date, is_active)
     VALUES ($1, 'pro', '2020-01-01', '2099-12-31', true) RETURNING id`,
    [`${P}_Co`],
  );
  companyId = coA.rows[0].id;

  /* Company B (for cross-tenant test) */
  const coB = await pool.query<{ id: number }>(
    `INSERT INTO companies (name, plan_type, start_date, end_date, is_active)
     VALUES ($1, 'pro', '2020-01-01', '2099-12-31', true) RETURNING id`,
    [`${P}_CoB`],
  );
  companyBId = coB.rows[0].id;

  /* Admin user for company A */
  const perms = JSON.stringify({
    can_view_treasury: true, can_add_expense: true,
    can_manage_payroll: true, can_view_employees: true,
  });
  const uA = await pool.query<{ id: number }>(
    `INSERT INTO erp_users (name, username, pin, role, permissions, active, company_id)
     VALUES ($1, $2, '0000', 'admin', $3::jsonb, true, $4) RETURNING id`,
    [`${P}_User`, `${P}_user`, perms, companyId],
  );
  userId = uA.rows[0].id;

  /* Admin user for company B */
  const uB = await pool.query<{ id: number }>(
    `INSERT INTO erp_users (name, username, pin, role, permissions, active, company_id)
     VALUES ($1, $2, '0000', 'admin', $3::jsonb, true, $4) RETURNING id`,
    [`${P}_UserB`, `${P}_userB`, perms, companyBId],
  );
  userBId = uB.rows[0].id;

  token  = jwt.sign({ userId, role: 'admin', companyId },  JWT_SECRET, { expiresIn: '1h' });
  tokenB = jwt.sign({ userId: userBId, role: 'admin', companyId: companyBId }, JWT_SECRET, { expiresIn: '1h' });

  /* Safes for transfer tests — A sends from src to dst */
  safeTransferSrcId = await createSafe(`${P}_TrfSrc`, 1000, companyId);
  safeTransferDstId = await createSafe(`${P}_TrfDst`, 0,    companyId);

  /* Safe for expense concurrency test */
  expenseSafeId = await createSafe(`${P}_ExpSafe`, 500, companyId);

  /* Safe in company A used in cross-tenant test */
  safeTransferSrcIdB = await createSafe(`${P}_CTSafe`, 9999, companyId);

  // قفل الفترة يعتمد على system_settings.closing_date — بدون إعداد فالفترة مفتوحة افتراضياً
});

/* ── Cleanup ─────────────────────────────────────────────────────── */

afterAll(async () => {
  try {
    const safeIds = [safeTransferSrcId, safeTransferDstId, expenseSafeId, safeTransferSrcIdB]
      .filter(Number.isFinite);

    await pool.query(`DELETE FROM safe_transfers WHERE company_id = $1`, [companyId]);
    await pool.query(`DELETE FROM transactions   WHERE company_id = $1`, [companyId]);
    await pool.query(`DELETE FROM transactions   WHERE company_id = $1`, [companyBId]);
    await pool.query(`DELETE FROM expenses        WHERE company_id = $1`, [companyId]);

    await pool.query(
      `DELETE FROM journal_entry_lines WHERE entry_id IN
       (SELECT id FROM journal_entries WHERE company_id = $1)`,
      [companyId],
    );
    await pool.query(`DELETE FROM journal_entries WHERE company_id = $1`, [companyId]);

    if (safeIds.length) {
      await pool.query(`DELETE FROM safes WHERE id = ANY($1::int[])`, [safeIds]);
    }

    await pool.query(`DELETE FROM erp_users WHERE id = ANY($1::int[])`, [[userId, userBId].filter(Number.isFinite)]);
    await pool.query(
      `DELETE FROM accounts WHERE company_id = ANY($1::int[])`,
      [[companyId, companyBId].filter(Number.isFinite)],
    );
    await pool.query(`DELETE FROM companies WHERE id = ANY($1::int[])`, [[companyId, companyBId].filter(Number.isFinite)]);
  } catch (err) {
    console.error('[concurrency cleanup] error:', err);
  }
});

/* ═══════════════════════════════════════════════════════════════════
   1. Concurrent Safe Transfers — same source safe
   ═══════════════════════════════════════════════════════════════════ */

describe('Concurrency — Safe Transfers (atomic debit guard)', () => {
  it('fires 6 transfers of 200 each from a 1000-balance safe concurrently — no overdraft', async () => {
    const AMOUNT = 200;
    const CONCURRENT = 6;

    const makeTransfer = () =>
      request(app)
        .post('/api/safe-transfers')
        .set('Authorization', `Bearer ${token}`)
        .send({
          from_safe_id: String(safeTransferSrcId),
          to_safe_id:   String(safeTransferDstId),
          amount:       AMOUNT,
          date:         '2099-01-15',
        });

    const results = await Promise.all(
      Array.from({ length: CONCURRENT }, makeTransfer),
    );

    const successes = results.filter(r => r.status === 201).length;
    const failures  = results.filter(r => r.status === 400).length;

    /* Exactly 5 should succeed (1000 / 200 = 5 max), 1 must fail */
    expect(successes, 'expected exactly 5 successful transfers').toBe(5);
    expect(failures,  'expected exactly 1 rejected transfer').toBe(1);

    /* Final balances must be consistent */
    const srcBalance = await getSafeBalance(safeTransferSrcId);
    const dstBalance = await getSafeBalance(safeTransferDstId);

    expect(srcBalance, 'source safe must reach exactly 0').toBe(0);
    expect(dstBalance, 'destination safe must reach exactly 1000').toBe(1000);
  });
});

/* ═══════════════════════════════════════════════════════════════════
   2. Concurrent Expenses — same safe
   ═══════════════════════════════════════════════════════════════════ */

describe('Concurrency — Expenses (atomic debit guard)', () => {
  it('fires 8 expenses of 100 each from a 500-balance safe concurrently — no overdraft', async () => {
    const AMOUNT = 100;
    const CONCURRENT = 8;

    const makeExpense = (i: number) =>
      request(app)
        .post('/api/expenses')
        .set('Authorization', `Bearer ${token}`)
        .send({
          category:    'مستلزمات مكتبية',
          amount:      AMOUNT,
          description: `اختبار تزامن ${i}`,
          safe_id:     String(expenseSafeId),
        });

    const results = await Promise.all(
      Array.from({ length: CONCURRENT }, (_, i) => makeExpense(i)),
    );

    const successes = results.filter(r => r.status === 201).length;
    const failures  = results.filter(r => r.status === 400).length;

    /* 5 should succeed (500 / 100 = 5), 3 must fail */
    expect(successes, 'expected exactly 5 successful expenses').toBe(5);
    expect(failures,  'expected exactly 3 rejected expenses').toBe(3);

    const balance = await getSafeBalance(expenseSafeId);
    expect(balance, 'safe balance must be exactly 0, never negative').toBe(0);
  });
});

/* ═══════════════════════════════════════════════════════════════════
   3. Cross-Tenant Safe Isolation
   ═══════════════════════════════════════════════════════════════════ */

describe('Cross-Tenant — company B cannot use company A safe', () => {
  it('POST /api/expenses with company B token using company A safe_id — must fail 400/403/404', async () => {
    const res = await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        category: 'اختبار عزل',
        amount:   100,
        safe_id:  String(safeTransferSrcIdB),
      });

    expect([400, 403, 404], 'cross-tenant safe usage must be blocked').toContain(res.status);

    /* Balance of company A safe must be untouched */
    const balance = await getSafeBalance(safeTransferSrcIdB);
    expect(balance, 'company A safe balance must remain 9999').toBe(9999);
  });

  it('POST /api/safe-transfers with company B token using company A safes — must fail 400/403/404', async () => {
    const res = await request(app)
      .post('/api/safe-transfers')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        from_safe_id: String(safeTransferSrcIdB),
        to_safe_id:   String(safeTransferDstId),
        amount:       100,
        date:         '2099-01-15',
      });

    expect([400, 403, 404], 'cross-tenant transfer must be blocked').toContain(res.status);

    const balance = await getSafeBalance(safeTransferSrcIdB);
    expect(balance, 'company A safe balance must remain untouched').toBe(9999);
  });
});
