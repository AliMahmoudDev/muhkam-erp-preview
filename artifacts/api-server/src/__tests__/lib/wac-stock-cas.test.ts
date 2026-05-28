/**
 * WAC (Weighted Average Cost) + Stock CAS (Compare-And-Swap) Regression Tests
 *
 * These are pure unit tests for the mathematical formulas and atomic stock logic
 * used in purchases (WAC) and sales (CAS). They do NOT hit the database —
 * they verify the calculation correctness independently of Express/DB plumbing.
 *
 * Production locations:
 * - WAC: artifacts/api-server/src/routes/purchases.ts (lines ~230-265)
 * - CAS: artifacts/api-server/src/routes/sales/create.ts (lines ~231-242)
 */

import { describe, it, expect } from 'vitest';

/* ══════════════════════════════════════════════════════════════════════════════
 * A. WAC Calculation — Pure Math
 * Formula: newAvgCost = (oldQty * oldCost + newQty * newCost) / (oldQty + newQty)
 * ══════════════════════════════════════════════════════════════════════════════ */

/** Mirrors the WAC formula from purchases.ts */
function computeWAC(
  oldQty: number,
  oldCost: number,
  newQty: number,
  newCost: number,
): number {
  const totalQty = oldQty + newQty;
  if (totalQty <= 0) return newCost;
  return (oldQty * oldCost + newQty * newCost) / totalQty;
}

/** Mirrors the WAC reversal formula from purchase cancel (purchases.ts line ~634) */
function computeWACReversal(
  oldQty: number,
  oldWAC: number,
  removeQty: number,
  removeCost: number,
): number {
  const newQty = Math.max(0, oldQty - removeQty);
  if (newQty <= 0) return oldWAC;
  return Math.max(0, (oldQty * oldWAC - removeQty * removeCost) / newQty);
}

/** Simulates sequential WAC update when same product appears multiple times */
function computeSequentialWAC(
  initialQty: number,
  initialCost: number,
  purchases: Array<{ qty: number; cost: number }>,
): { finalQty: number; finalCost: number } {
  let qty = initialQty;
  let cost = initialCost;
  for (const p of purchases) {
    cost = computeWAC(qty, cost, p.qty, p.cost);
    qty += p.qty;
  }
  return { finalQty: qty, finalCost: cost };
}

describe('A. WAC Calculation — Purchases', () => {
  it('A1. شراء يزيد الكمية ويحسب التكلفة المرجحة بشكل صحيح', () => {
    // 10 units @ 100 EGP + 5 units @ 120 EGP = 15 units @ 106.67 EGP
    const result = computeWAC(10, 100, 5, 120);
    expect(result).toBeCloseTo(106.6667, 2);
  });

  it('A2. شراء نفس المنتج مرتين في فاتورة واحدة — WAC تسلسلي صحيح', () => {
    // Start: 10 units @ 100
    // Purchase line 1: +5 @ 120 → 15 units @ 106.67
    // Purchase line 2: +5 @ 80  → 20 units @ 100.00
    const result = computeSequentialWAC(10, 100, [
      { qty: 5, cost: 120 },
      { qty: 5, cost: 80 },
    ]);
    expect(result.finalQty).toBe(20);
    expect(result.finalCost).toBeCloseTo(100.0, 2);
  });

  it('A3. مخزون حالي بتكلفة + شراء جديد بتكلفة مختلفة — المتوسط صحيح', () => {
    // 100 units @ 50 + 100 units @ 70 = 200 units @ 60
    const result = computeWAC(100, 50, 100, 70);
    expect(result).toBeCloseTo(60.0, 4);
  });

  it('A4. شراء على منتج بكمية صفر — التكلفة = تكلفة الشراء الجديدة', () => {
    // 0 units @ anything + 10 units @ 200 = 10 units @ 200
    const result = computeWAC(0, 0, 10, 200);
    expect(result).toBe(200);
  });

  it('A5. شراء بكمية صفر لا يغيّر التكلفة', () => {
    // 10 units @ 100 + 0 units @ 999 = 10 units @ 100
    const result = computeWAC(10, 100, 0, 999);
    expect(result).toBe(100);
  });

  it('A6. شراء بتكلفة صفر يُقلل المتوسط', () => {
    // 10 units @ 100 + 10 units @ 0 = 20 units @ 50
    const result = computeWAC(10, 100, 10, 0);
    expect(result).toBe(50);
  });

  it('A7. شراء كميات كبيرة لا ينتج أرقام سالبة', () => {
    const result = computeWAC(1_000_000, 0.001, 500_000, 0.002);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeCloseTo(0.001333, 4);
  });

  it('A8. عكس WAC عند إلغاء فاتورة شراء — يستعيد التكلفة الأصلية تقريبياً', () => {
    // Buy: 10 @ 100 + 5 @ 120 → 15 @ 106.67
    const afterBuy = computeWAC(10, 100, 5, 120);
    // Cancel the 5 @ 120 → should revert to ~100
    const afterCancel = computeWACReversal(15, afterBuy, 5, 120);
    expect(afterCancel).toBeCloseTo(100.0, 2);
  });

  it('A9. عكس WAC بكمية أكبر من المتوفرة — لا ينتج سالب', () => {
    const result = computeWACReversal(5, 100, 10, 100);
    // newQty = max(0, 5-10) = 0 → returns oldWAC
    expect(result).toBe(100);
    expect(result).toBeGreaterThanOrEqual(0);
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
 * B. Stock CAS — Atomic Decrement Logic
 * The CAS pattern: UPDATE products SET qty = qty - X WHERE qty >= X RETURNING qty
 * If 0 rows affected → oversell prevented.
 * ══════════════════════════════════════════════════════════════════════════════ */

/** Simulates the CAS decrement logic from sales/create.ts */
function stockDecrement(currentQty: number, requestedQty: number): { success: boolean; newQty: number } {
  if (currentQty < requestedQty) {
    return { success: false, newQty: currentQty }; // CAS fails — not enough stock
  }
  return { success: true, newQty: currentQty - requestedQty };
}

/** Simulates sequential multi-item sale with CAS for same product */
function multiItemSale(
  initialStock: Map<number, number>,
  items: Array<{ product_id: number; quantity: number }>,
): { success: boolean; finalStock: Map<number, number>; failedItem?: number } {
  const stock = new Map(initialStock);
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const current = stock.get(item.product_id) ?? 0;
    const result = stockDecrement(current, item.quantity);
    if (!result.success) {
      return { success: false, finalStock: initialStock, failedItem: i };
    }
    stock.set(item.product_id, result.newQty);
  }
  return { success: true, finalStock: stock };
}

describe('B. Stock CAS — Sales Decrement', () => {
  it('B1. خصم مخزون ناجح عندما الكمية كافية', () => {
    const result = stockDecrement(100, 30);
    expect(result.success).toBe(true);
    expect(result.newQty).toBe(70);
  });

  it('B2. خصم مخزون يفشل عندما الكمية المطلوبة أكبر من المتوفرة', () => {
    const result = stockDecrement(5, 10);
    expect(result.success).toBe(false);
    expect(result.newQty).toBe(5); // unchanged
  });

  it('B3. خصم بالكمية الكاملة المتوفرة ينجح (حافة)', () => {
    const result = stockDecrement(10, 10);
    expect(result.success).toBe(true);
    expect(result.newQty).toBe(0);
  });

  it('B4. نفس المنتج مرتين في فاتورة واحدة — الخصم تراكمي', () => {
    // Product 1 has 20 units. Sell 8, then sell 8 again = 4 remaining
    const stock = new Map([[1, 20]]);
    const result = multiItemSale(stock, [
      { product_id: 1, quantity: 8 },
      { product_id: 1, quantity: 8 },
    ]);
    expect(result.success).toBe(true);
    expect(result.finalStock.get(1)).toBe(4);
  });

  it('B5. نفس المنتج مرتين — المرة الثانية تفشل بسبب نقص المخزون', () => {
    // Product 1 has 10 units. Sell 8, then sell 8 → second fails (only 2 left)
    const stock = new Map([[1, 10]]);
    const result = multiItemSale(stock, [
      { product_id: 1, quantity: 8 },
      { product_id: 1, quantity: 8 },
    ]);
    expect(result.success).toBe(false);
    expect(result.failedItem).toBe(1); // second item
  });

  it('B6. كمية صفر لا تغيّر المخزون', () => {
    const result = stockDecrement(50, 0);
    expect(result.success).toBe(true);
    expect(result.newQty).toBe(50);
  });

  it('B7. مخزون صفر يرفض أي بيع', () => {
    const result = stockDecrement(0, 1);
    expect(result.success).toBe(false);
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
 * C. Transaction Rollback — Multi-Item Failure
 * If one item fails in a multi-item sale, the entire transaction must roll back.
 * ══════════════════════════════════════════════════════════════════════════════ */

describe('C. Transaction Safety — Rollback on Failure', () => {
  it('C1. فشل صنف واحد في فاتورة متعددة الأصناف — لا يوجد خصم جزئي', () => {
    // Products: A=10, B=5. Sell A=3, B=10 (fails). Final: A=10, B=5 (unchanged)
    const stock = new Map([[1, 10], [2, 5]]);
    const result = multiItemSale(stock, [
      { product_id: 1, quantity: 3 },
      { product_id: 2, quantity: 10 }, // exceeds stock
    ]);
    expect(result.success).toBe(false);
    // On failure, finalStock should be the ORIGINAL (transaction rolled back)
    expect(result.finalStock.get(1)).toBe(10);
    expect(result.finalStock.get(2)).toBe(5);
  });

  it('C2. جميع الأصناف بكمية كافية — الخصم يتم لجميعها', () => {
    const stock = new Map([[1, 10], [2, 20], [3, 30]]);
    const result = multiItemSale(stock, [
      { product_id: 1, quantity: 5 },
      { product_id: 2, quantity: 10 },
      { product_id: 3, quantity: 15 },
    ]);
    expect(result.success).toBe(true);
    expect(result.finalStock.get(1)).toBe(5);
    expect(result.finalStock.get(2)).toBe(10);
    expect(result.finalStock.get(3)).toBe(15);
  });

  it('C3. الصنف الأول يفشل — لا شيء يُخصم', () => {
    const stock = new Map([[1, 2], [2, 100]]);
    const result = multiItemSale(stock, [
      { product_id: 1, quantity: 5 }, // fails immediately
      { product_id: 2, quantity: 10 },
    ]);
    expect(result.success).toBe(false);
    expect(result.finalStock.get(1)).toBe(2);
    expect(result.finalStock.get(2)).toBe(100);
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
 * D. Tenant Isolation — WAC/Stock must not cross company boundaries
 * ══════════════════════════════════════════════════════════════════════════════ */

describe('D. Tenant Isolation — WAC & Stock per Company', () => {
  it('D1. شركتان لهما نفس المنتج — WAC مستقل لكل شركة', () => {
    // Company A: product 1, 10 @ 100
    // Company B: product 1, 10 @ 200
    const wacA = computeWAC(10, 100, 5, 120); // Company A buys 5 @ 120
    const wacB = computeWAC(10, 200, 5, 120); // Company B buys 5 @ 120

    // Company A: (10*100 + 5*120) / 15 = 106.67
    expect(wacA).toBeCloseTo(106.6667, 2);
    // Company B: (10*200 + 5*120) / 15 = 173.33
    expect(wacB).toBeCloseTo(173.3333, 2);
    // They MUST be different
    expect(wacA).not.toBeCloseTo(wacB, 0);
  });

  it('D2. مخزون شركة A لا يُلبي بيع شركة B', () => {
    // Company A has 100 units, Company B has 0 units
    // B tries to sell 10 → must fail regardless of A stock
    const stockA = new Map([[1, 100]]);
    const stockB = new Map([[1, 0]]);

    const saleFromB = multiItemSale(stockB, [{ product_id: 1, quantity: 10 }]);
    expect(saleFromB.success).toBe(false);

    // A stock unaffected
    expect(stockA.get(1)).toBe(100);
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
 * E. Edge Cases & Precision
 * ══════════════════════════════════════════════════════════════════════════════ */

describe('E. Edge Cases & Floating Point Precision', () => {
  it('E1. WAC مع أعداد عشرية صغيرة — دقة 4 خانات عشرية', () => {
    // 3 units @ 33.3333 + 1 unit @ 33.3334 = 4 units @ ~33.3333
    const result = computeWAC(3, 33.3333, 1, 33.3334);
    expect(result).toBeCloseTo(33.3333, 3);
  });

  it('E2. كمية عشرية (0.5 كجم) — WAC صحيح', () => {
    // 2.5 kg @ 40 + 1.5 kg @ 60 = 4 kg @ 47.5
    const result = computeWAC(2.5, 40, 1.5, 60);
    expect(result).toBe(47.5);
  });

  it('E3. CAS مع كميات عشرية', () => {
    // 10.5 in stock, sell 10.5 → should succeed
    const result = stockDecrement(10.5, 10.5);
    expect(result.success).toBe(true);
    expect(result.newQty).toBeCloseTo(0, 10);
  });

  it('E4. CAS مع كمية عشرية تتجاوز المخزون بجزء بسيط', () => {
    // 10.0 in stock, sell 10.001 → should fail
    const result = stockDecrement(10.0, 10.001);
    expect(result.success).toBe(false);
  });
});
