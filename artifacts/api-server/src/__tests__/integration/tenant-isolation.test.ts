/**
 * Multi-Tenant Isolation — Real Integration Tests
 *
 * Rules:
 *  - Zero mocks. @workspace/db is the real connection (DATABASE_URL from env).
 *  - JWT tokens are signed with the test secret set in setup.ts.
 *  - The real Express app handles every request via supertest.
 *  - Assertions rely entirely on actual DB filtering; no manual filtering.
 *  - Cleanup runs in afterAll regardless of test outcomes.
 */

import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { pool } from '@workspace/db';
import app from '../../app';

/* ── Constants ──────────────────────────────────────────────────── */

const JWT_SECRET = 'integration-test-jwt-secret-minimum-32chars!!';
const RUN_ID     = Date.now();               // unique tag for this test run
const PREFIX     = `INTTEST_${RUN_ID}`;      // safe to grep / delete by

/* ── Shared state (populated in beforeAll) ──────────────────────── */

let companyBId:   number;
let warehouseAId: number;
let warehouseBId: number;
let userAId:      number;
let userBId:      number;
let productAId:   number;
let productBId:   number;

let tokenA: string;
let tokenB: string;

/* Captured from POST responses — used for isolation assertions */
let saleAId:      number;
let saleBId:      number;
let purchaseAId:  number;
let purchaseBId:  number;

let saleAInvoice:     string;
let saleBInvoice:     string;
let purchaseAInvoice: string;
let purchaseBInvoice: string;

/* ── Helper: extract invoice_no list from GET /sales or /purchases ── */
interface InvoiceItem { id: number; invoice_no: string }
function extractInvoices(body: unknown): InvoiceItem[] {
  if (Array.isArray(body)) return body as InvoiceItem[];
  const wrapped = body as { data?: InvoiceItem[] };
  return wrapped.data ?? [];
}

/* ── Setup ──────────────────────────────────────────────────────── */

beforeAll(async () => {
  /* 1. Ensure company 1 exists (the main seed company) */
  await pool.query(`
    INSERT INTO companies (id, name, plan_type, start_date, end_date, is_active)
    VALUES (1, 'HalalTech', 'pro', '2020-01-01', '2099-12-31', true)
    ON CONFLICT (id) DO NOTHING
  `);

  /* 2. Insert a fresh, isolated test company for tenant B */
  const coRes = await pool.query<{ id: number }>(`
    INSERT INTO companies (name, plan_type, start_date, end_date, is_active)
    VALUES ($1, 'pro', '2020-01-01', '2099-12-31', true)
    RETURNING id
  `, [`${PREFIX}_CompanyB`]);
  companyBId = coRes.rows[0].id;

  /* 3. Insert a warehouse per company (required by sales/purchases routes) */
  const waRes = await pool.query<{ id: number }>(`
    INSERT INTO warehouses (name, company_id)
    VALUES ($1, 1)
    RETURNING id
  `, [`${PREFIX}_WarehouseA`]);
  warehouseAId = waRes.rows[0].id;

  const wbRes = await pool.query<{ id: number }>(`
    INSERT INTO warehouses (name, company_id)
    VALUES ($1, $2)
    RETURNING id
  `, [`${PREFIX}_WarehouseB`, companyBId]);
  warehouseBId = wbRes.rows[0].id;

  /* 4. Insert two admin users — one per company */
  const uaRes = await pool.query<{ id: number }>(`
    INSERT INTO erp_users (name, username, pin, role, permissions, active, company_id)
    VALUES ($1, $2, '0000', 'admin', '{}', true, 1)
    RETURNING id
  `, [`${PREFIX}_UserA`, `${PREFIX}_userA`]);
  userAId = uaRes.rows[0].id;

  const ubRes = await pool.query<{ id: number }>(`
    INSERT INTO erp_users (name, username, pin, role, permissions, active, company_id)
    VALUES ($1, $2, '0000', 'admin', '{}', true, $3)
    RETURNING id
  `, [`${PREFIX}_UserB`, `${PREFIX}_userB`, companyBId]);
  userBId = ubRes.rows[0].id;

  /* 5. Insert one product per company (quantity=100 so sales stock checks pass) */
  const paRes = await pool.query<{ id: number }>(`
    INSERT INTO products (name, sku, quantity, cost_price, sale_price, company_id)
    VALUES ($1, $2, 100, 10, 20, 1)
    RETURNING id
  `, [`${PREFIX}_ProductA`, `${PREFIX}-SKU-A`]);
  productAId = paRes.rows[0].id;

  const pbRes = await pool.query<{ id: number }>(`
    INSERT INTO products (name, sku, quantity, cost_price, sale_price, company_id)
    VALUES ($1, $2, 100, 10, 20, $3)
    RETURNING id
  `, [`${PREFIX}_ProductB`, `${PREFIX}-SKU-B`, companyBId]);
  productBId = pbRes.rows[0].id;

  /* 6. Sign JWT tokens (same secret used in integration/setup.ts) */
  tokenA = jwt.sign(
    { userId: userAId, role: 'admin', companyId: 1 },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
  tokenB = jwt.sign(
    { userId: userBId, role: 'admin', companyId: companyBId },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
});

/* ── Cleanup ────────────────────────────────────────────────────── */

afterAll(async () => {
  /*
   * Delete in correct FK order (no CASCADE defined on most relations).
   *
   * journal_entry_lines.entry_id → journal_entries.id
   * transactions.reference_id → (sale|purchase).id
   * customer_ledger.reference_id → sale.id
   * stock_movements.reference_id → (sale|purchase).id
   * sale_items.sale_id → sales.id
   * purchase_items.purchase_id → purchases.id
   */
  try {
    const saleIds     = [saleAId, saleBId].filter(Number.isFinite);
    const purchaseIds = [purchaseAId, purchaseBId].filter(Number.isFinite);
    const allRefIds   = [...saleIds, ...purchaseIds];

    /* journal_entry_lines (FK: entry_id → journal_entries.id) */
    if (allRefIds.length) {
      await pool.query(`
        DELETE FROM journal_entry_lines
        WHERE entry_id IN (
          SELECT id FROM journal_entries
          WHERE company_id = 1 AND reference_id = ANY($1::int[])
        )
      `, [allRefIds]);
    }
    await pool.query(`
      DELETE FROM journal_entry_lines
      WHERE entry_id IN (
        SELECT id FROM journal_entries WHERE company_id = $1
      )
    `, [companyBId]);

    /* journal_entries */
    if (allRefIds.length) {
      await pool.query(`
        DELETE FROM journal_entries
        WHERE company_id = 1 AND reference_id = ANY($1::int[])
      `, [allRefIds]);
    }
    await pool.query(`DELETE FROM journal_entries WHERE company_id = $1`, [companyBId]);

    /* transactions */
    if (saleIds.length) {
      await pool.query(`
        DELETE FROM transactions
        WHERE company_id = 1
          AND reference_type = 'sale'
          AND reference_id = ANY($1::int[])
      `, [saleIds]);
    }
    if (purchaseIds.length) {
      await pool.query(`
        DELETE FROM transactions
        WHERE company_id = 1
          AND reference_type = 'purchase'
          AND reference_id = ANY($1::int[])
      `, [purchaseIds]);
    }
    await pool.query(`DELETE FROM transactions WHERE company_id = $1`, [companyBId]);

    /* customer_ledger */
    if (saleIds.length) {
      await pool.query(`
        DELETE FROM customer_ledger
        WHERE company_id = 1 AND reference_id = ANY($1::int[])
      `, [saleIds]);
    }
    await pool.query(`DELETE FROM customer_ledger WHERE company_id = $1`, [companyBId]);

    /* stock_movements */
    if (saleIds.length) {
      await pool.query(`
        DELETE FROM stock_movements
        WHERE company_id = 1
          AND reference_type = 'sale'
          AND reference_id = ANY($1::int[])
      `, [saleIds]);
    }
    if (purchaseIds.length) {
      await pool.query(`
        DELETE FROM stock_movements
        WHERE company_id = 1
          AND reference_type = 'purchase'
          AND reference_id = ANY($1::int[])
      `, [purchaseIds]);
    }
    await pool.query(`DELETE FROM stock_movements WHERE company_id = $1`, [companyBId]);

    /* sale_items → sales */
    if (saleIds.length) {
      await pool.query(`DELETE FROM sale_items   WHERE sale_id     = ANY($1::int[])`, [saleIds]);
      await pool.query(`DELETE FROM sales        WHERE id          = ANY($1::int[]) AND company_id = 1`, [saleIds]);
    }
    await pool.query(`
      DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE company_id = $1)
    `, [companyBId]);
    await pool.query(`DELETE FROM sales WHERE company_id = $1`, [companyBId]);

    /* purchase_items → purchases */
    if (purchaseIds.length) {
      await pool.query(`DELETE FROM purchase_items WHERE purchase_id = ANY($1::int[])`, [purchaseIds]);
      await pool.query(`DELETE FROM purchases      WHERE id          = ANY($1::int[]) AND company_id = 1`, [purchaseIds]);
    }
    await pool.query(`
      DELETE FROM purchase_items WHERE purchase_id IN (SELECT id FROM purchases WHERE company_id = $1)
    `, [companyBId]);
    await pool.query(`DELETE FROM purchases WHERE company_id = $1`, [companyBId]);

    /* products */
    await pool.query(`
      DELETE FROM products WHERE id = ANY($1::int[])
    `, [[productAId, productBId].filter(Number.isFinite)]);

    /* audit_logs keyed on the test user IDs */
    await pool.query(`
      DELETE FROM audit_logs WHERE user_id = ANY($1::int[])
    `, [[userAId, userBId].filter(Number.isFinite)]);

    /* erp_users */
    await pool.query(`
      DELETE FROM erp_users WHERE id = ANY($1::int[])
    `, [[userAId, userBId].filter(Number.isFinite)]);

    /* warehouses */
    await pool.query(`
      DELETE FROM warehouses WHERE id = ANY($1::int[])
    `, [[warehouseAId, warehouseBId].filter(Number.isFinite)]);

    /* company B */
    if (companyBId) {
      await pool.query(`DELETE FROM companies WHERE id = $1`, [companyBId]);
    }
  } catch (err) {
    console.error('[integration cleanup] error:', err);
  }
});

/* ═══════════════════════════════════════════════════════════════════
   TESTS
   ═══════════════════════════════════════════════════════════════════ */

describe('Multi-Tenant Isolation — Sales', () => {

  it('POST /api/sales — company A creates a sale (201)', async () => {
    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('X-Request-Id',  `${PREFIX}-sale-A`)
      .set('Content-Type',  'application/json')
      .send({
        payment_type: 'credit',
        total_amount:  20,
        paid_amount:   0,
        warehouse_id:  warehouseAId,
        items: [{
          product_id:   productAId,
          product_name: `${PREFIX}_ProductA`,
          quantity:     1,
          unit_price:   20,
          total_price:  20,
        }],
      });

    if (res.status !== 201) {
      console.error('POST /api/sales company A failed:', JSON.stringify(res.body));
    }
    expect(res.status).toBe(201);
    expect(res.body.invoice_no).toBeTruthy();
    saleAId      = res.body.id      as number;
    saleAInvoice = res.body.invoice_no as string;
  });

  it('POST /api/sales — company B creates a sale (201)', async () => {
    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${tokenB}`)
      .set('X-Request-Id',  `${PREFIX}-sale-B`)
      .set('Content-Type',  'application/json')
      .send({
        payment_type: 'credit',
        total_amount:  20,
        paid_amount:   0,
        warehouse_id:  warehouseBId,
        items: [{
          product_id:   productBId,
          product_name: `${PREFIX}_ProductB`,
          quantity:     1,
          unit_price:   20,
          total_price:  20,
        }],
      });

    if (res.status !== 201) {
      console.error('POST /api/sales company B failed:', JSON.stringify(res.body));
    }
    expect(res.status).toBe(201);
    expect(res.body.invoice_no).toBeTruthy();
    saleBId      = res.body.id      as number;
    saleBInvoice = res.body.invoice_no as string;
  });

  it('GET /api/sales with tokenA — returns own sale, NEVER company B sale', async () => {
    expect(saleAInvoice, 'POST company A sale must have succeeded first').toBeTruthy();
    expect(saleBInvoice, 'POST company B sale must have succeeded first').toBeTruthy();

    const res = await request(app)
      .get('/api/sales')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);

    const invoices = extractInvoices(res.body).map(s => s.invoice_no);

    expect(invoices, 'company A token must see its own sale').toContain(saleAInvoice);
    expect(invoices, 'company A token must NOT see company B sale').not.toContain(saleBInvoice);
  });

  it('GET /api/sales with tokenB — returns own sale, NEVER company A sale', async () => {
    expect(saleAInvoice, 'POST company A sale must have succeeded first').toBeTruthy();
    expect(saleBInvoice, 'POST company B sale must have succeeded first').toBeTruthy();

    const res = await request(app)
      .get('/api/sales')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200);

    const invoices = extractInvoices(res.body).map(s => s.invoice_no);

    expect(invoices, 'company B token must see its own sale').toContain(saleBInvoice);
    expect(invoices, 'company B token must NOT see company A sale').not.toContain(saleAInvoice);
  });
});

describe('Multi-Tenant Isolation — Purchases', () => {

  it('POST /api/purchases — company A creates a purchase (201)', async () => {
    const res = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('X-Request-Id',  `${PREFIX}-purchase-A`)
      .set('Content-Type',  'application/json')
      .send({
        payment_type:  'credit',
        total_amount:  10,
        paid_amount:   0,
        supplier_name: `${PREFIX}_SupplierA`,
        warehouse_id:  warehouseAId,
        items: [{
          product_id:   productAId,
          product_name: `${PREFIX}_ProductA`,
          quantity:     1,
          unit_price:   10,
          total_price:  10,
        }],
      });

    if (res.status !== 201) {
      console.error('POST /api/purchases company A failed:', JSON.stringify(res.body));
    }
    expect(res.status).toBe(201);
    expect(res.body.invoice_no).toBeTruthy();
    purchaseAId      = res.body.id      as number;
    purchaseAInvoice = res.body.invoice_no as string;
  });

  it('POST /api/purchases — company B creates a purchase (201)', async () => {
    const res = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${tokenB}`)
      .set('X-Request-Id',  `${PREFIX}-purchase-B`)
      .set('Content-Type',  'application/json')
      .send({
        payment_type:  'credit',
        total_amount:  10,
        paid_amount:   0,
        supplier_name: `${PREFIX}_SupplierB`,
        warehouse_id:  warehouseBId,
        items: [{
          product_id:   productBId,
          product_name: `${PREFIX}_ProductB`,
          quantity:     1,
          unit_price:   10,
          total_price:  10,
        }],
      });

    if (res.status !== 201) {
      console.error('POST /api/purchases company B failed:', JSON.stringify(res.body));
    }
    expect(res.status).toBe(201);
    expect(res.body.invoice_no).toBeTruthy();
    purchaseBId      = res.body.id      as number;
    purchaseBInvoice = res.body.invoice_no as string;
  });

  it('GET /api/purchases with tokenA — returns own purchase, NEVER company B purchase', async () => {
    expect(purchaseAInvoice, 'POST company A purchase must have succeeded first').toBeTruthy();
    expect(purchaseBInvoice, 'POST company B purchase must have succeeded first').toBeTruthy();

    const res = await request(app)
      .get('/api/purchases')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);

    const invoices = extractInvoices(res.body).map(p => p.invoice_no);

    expect(invoices, 'company A token must see its own purchase').toContain(purchaseAInvoice);
    expect(invoices, 'company A token must NOT see company B purchase').not.toContain(purchaseBInvoice);
  });

  it('GET /api/purchases with tokenB — returns own purchase, NEVER company A purchase', async () => {
    expect(purchaseAInvoice, 'POST company A purchase must have succeeded first').toBeTruthy();
    expect(purchaseBInvoice, 'POST company B purchase must have succeeded first').toBeTruthy();

    const res = await request(app)
      .get('/api/purchases')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200);

    const invoices = extractInvoices(res.body).map(p => p.invoice_no);

    expect(invoices, 'company B token must see its own purchase').toContain(purchaseBInvoice);
    expect(invoices, 'company B token must NOT see company A purchase').not.toContain(purchaseAInvoice);
  });
});

/* ═══════════════════════════════════════════════════════════════════
   BY-ID ISOLATION — cross-tenant read/mutate on single records
   ═══════════════════════════════════════════════════════════════════ */

describe('Multi-Tenant Isolation — Sales by ID (cross-tenant blocked)', () => {

  it('GET /api/sales/:id with tokenA — can read own sale', async () => {
    expect(saleAId, 'sale A must have been created').toBeTruthy();

    const res = await request(app)
      .get(`/api/sales/${saleAId}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(saleAId);
  });

  it('GET /api/sales/:id with tokenB using company A sale ID — blocked (404)', async () => {
    expect(saleAId, 'sale A must have been created').toBeTruthy();

    const res = await request(app)
      .get(`/api/sales/${saleAId}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(404);
  });

  it('POST /api/sales/:id/post with tokenB using company A sale ID — blocked (404)', async () => {
    expect(saleAId, 'sale A must have been created').toBeTruthy();

    const res = await request(app)
      .post(`/api/sales/${saleAId}/post`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(404);
  });

  it('POST /api/sales/:id/cancel with tokenB using company A sale ID — blocked (404)', async () => {
    expect(saleAId, 'sale A must have been created').toBeTruthy();

    const res = await request(app)
      .post(`/api/sales/${saleAId}/cancel`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(404);
  });

  it('GET /api/sales/:id with tokenB — can read own sale', async () => {
    expect(saleBId, 'sale B must have been created').toBeTruthy();

    const res = await request(app)
      .get(`/api/sales/${saleBId}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(saleBId);
  });

  it('GET /api/sales/:id with tokenA using company B sale ID — blocked (404)', async () => {
    expect(saleBId, 'sale B must have been created').toBeTruthy();

    const res = await request(app)
      .get(`/api/sales/${saleBId}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(404);
  });
});

describe('Multi-Tenant Isolation — Purchases by ID (cross-tenant blocked)', () => {

  it('GET /api/purchases/:id with tokenA — can read own purchase', async () => {
    expect(purchaseAId, 'purchase A must have been created').toBeTruthy();

    const res = await request(app)
      .get(`/api/purchases/${purchaseAId}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(purchaseAId);
  });

  it('GET /api/purchases/:id with tokenB using company A purchase ID — blocked (404)', async () => {
    expect(purchaseAId, 'purchase A must have been created').toBeTruthy();

    const res = await request(app)
      .get(`/api/purchases/${purchaseAId}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(404);
  });

  it('POST /api/purchases/:id/post with tokenB using company A purchase ID — blocked (404)', async () => {
    expect(purchaseAId, 'purchase A must have been created').toBeTruthy();

    const res = await request(app)
      .post(`/api/purchases/${purchaseAId}/post`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(404);
  });

  it('POST /api/purchases/:id/cancel with tokenB using company A purchase ID — blocked (404)', async () => {
    expect(purchaseAId, 'purchase A must have been created').toBeTruthy();

    const res = await request(app)
      .post(`/api/purchases/${purchaseAId}/cancel`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(404);
  });

  it('GET /api/purchases/:id with tokenB — can read own purchase', async () => {
    expect(purchaseBId, 'purchase B must have been created').toBeTruthy();

    const res = await request(app)
      .get(`/api/purchases/${purchaseBId}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(purchaseBId);
  });

  it('GET /api/purchases/:id with tokenA using company B purchase ID — blocked (404)', async () => {
    expect(purchaseBId, 'purchase B must have been created').toBeTruthy();

    const res = await request(app)
      .get(`/api/purchases/${purchaseBId}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(404);
  });
});
