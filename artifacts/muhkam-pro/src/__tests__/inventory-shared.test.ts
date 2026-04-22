import { describe, it, expect } from 'vitest';
import { movementTypeLabel, today, nowTime, api, BASE } from '../pages/inventory/_shared';
import type { AuditProduct, LowStockItem } from '../pages/inventory/_shared';

describe('inventory _shared utilities', () => {
  describe('movementTypeLabel', () => {
    it('maps all known movement types to Arabic labels', () => {
      expect(movementTypeLabel.opening_balance.label).toBe('رصيد افتتاحي');
      expect(movementTypeLabel.purchase.label).toBe('مشتريات');
      expect(movementTypeLabel.sale.label).toBe('مبيعات');
      expect(movementTypeLabel.sale_return.label).toBe('مرتجع مبيعات');
      expect(movementTypeLabel.purchase_return.label).toBe('مرتجع مشتريات');
      expect(movementTypeLabel.adjustment.label).toBe('تسوية يدوية');
      expect(movementTypeLabel.transfer_out.label).toBe('تحويل خروج');
      expect(movementTypeLabel.transfer_in.label).toBe('تحويل دخول');
    });
    it('attaches a non-empty color class to every entry', () => {
      for (const v of Object.values(movementTypeLabel)) {
        expect(v.color).toMatch(/bg-/);
        expect(v.color).toMatch(/text-/);
      }
    });
  });

  describe('today / nowTime', () => {
    it('today returns ISO date YYYY-MM-DD', () => {
      expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
    it('nowTime returns HH:MM 24h format', () => {
      expect(nowTime()).toMatch(/^\d{2}:\d{2}$/);
    });
  });

  describe('api / BASE', () => {
    it('api prepends BASE to a path', () => {
      expect(api('/api/test')).toBe(`${BASE}/api/test`);
    });
  });
});

describe('inventory filter logic', () => {
  const products: AuditProduct[] = [
    {
      id: 1,
      name: 'iPhone شاشة',
      sku: 'IP-SCR-01',
      category: 'شاشات',
      actual_qty: 5,
      cost_price: 100,
      sale_price: 200,
      low_stock_threshold: 10,
      opening_qty: 0,
      purchased_qty: 10,
      sold_qty: 5,
      sale_return_qty: 0,
      purchase_return_qty: 0,
      adjustment_qty: 0,
      calculated_qty: 5,
      discrepancy: 0,
      total_value: 500,
    },
    {
      id: 2,
      name: 'Samsung بطارية',
      sku: 'SS-BAT-09',
      category: 'بطاريات',
      actual_qty: 0,
      cost_price: 50,
      sale_price: 100,
      low_stock_threshold: 5,
      opening_qty: 5,
      purchased_qty: 0,
      sold_qty: 5,
      sale_return_qty: 0,
      purchase_return_qty: 0,
      adjustment_qty: 0,
      calculated_qty: 0,
      discrepancy: 0,
      total_value: 0,
    },
    {
      id: 3,
      name: 'Charger USB-C',
      sku: 'CHG-USC-22',
      category: 'شواحن',
      actual_qty: 50,
      cost_price: 20,
      sale_price: 40,
      low_stock_threshold: null,
      opening_qty: 50,
      purchased_qty: 0,
      sold_qty: 0,
      sale_return_qty: 0,
      purchase_return_qty: 0,
      adjustment_qty: 0,
      calculated_qty: 50,
      discrepancy: 0,
      total_value: 1000,
    },
  ];

  function searchFilter(rows: AuditProduct[], q: string) {
    const ql = q.toLowerCase();
    return rows.filter(
      (p) =>
        !ql ||
        p.name.toLowerCase().includes(ql) ||
        (p.sku ?? '').toLowerCase().includes(ql) ||
        (p.category ?? '').toLowerCase().includes(ql)
    );
  }

  it('filters by SKU substring (case-insensitive)', () => {
    expect(searchFilter(products, 'ip-scr').map((p) => p.id)).toEqual([1]);
    expect(searchFilter(products, 'CHG').map((p) => p.id)).toEqual([3]);
  });
  it('filters by Arabic name substring', () => {
    expect(searchFilter(products, 'بطارية').map((p) => p.id)).toEqual([2]);
  });
  it('filters by category', () => {
    expect(searchFilter(products, 'شواحن').map((p) => p.id)).toEqual([3]);
  });
  it('returns all rows for empty query', () => {
    expect(searchFilter(products, '')).toHaveLength(3);
  });

  it('zero-only filter selects out-of-stock', () => {
    const zero = products.filter((p) => p.actual_qty <= 0);
    expect(zero.map((p) => p.id)).toEqual([2]);
  });

  it('low-only filter selects below threshold (excluding null)', () => {
    const low = products.filter(
      (p) => p.low_stock_threshold !== null && p.actual_qty <= p.low_stock_threshold
    );
    expect(low.map((p) => p.id).sort()).toEqual([1, 2]);
  });

  it('positive filter excludes zero stock', () => {
    const pos = products.filter((p) => p.actual_qty > 0);
    expect(pos.map((p) => p.id).sort()).toEqual([1, 3]);
  });
});

describe('reorder priority sort', () => {
  const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const items = [
    { product_id: 1, priority: 'low', suggested_cost: 100 },
    { product_id: 2, priority: 'critical', suggested_cost: 50 },
    { product_id: 3, priority: 'high', suggested_cost: 200 },
    { product_id: 4, priority: 'critical', suggested_cost: 300 },
  ];
  it('sorts by priority then by descending cost', () => {
    const sorted = [...items].sort((a, b) => {
      const d = order[a.priority] - order[b.priority];
      if (d !== 0) return d;
      return b.suggested_cost - a.suggested_cost;
    });
    expect(sorted.map((i) => i.product_id)).toEqual([4, 2, 3, 1]);
  });
});

describe('LowStockItem typing', () => {
  it('shapes a sample item correctly', () => {
    const item: LowStockItem = {
      product_id: 1,
      product_name: 'X',
      sku: null,
      category: null,
      cost_price: 10,
      min_stock: 5,
      warehouse_id: 1,
      warehouse_name: 'الرئيسي',
      current_qty: 0,
      shortage: 5,
      suggested_qty: 10,
      is_zero: true,
      available_elsewhere: [],
    };
    expect(item.is_zero).toBe(true);
  });
});
