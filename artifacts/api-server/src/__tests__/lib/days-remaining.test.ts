import { describe, it, expect } from 'vitest';
import { daysRemaining } from '../../routes/super/companies/helpers';

describe('daysRemaining', () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  it('يُعيد 0 لتاريخ اليوم', () => {
    expect(daysRemaining(fmt(today))).toBe(0);
  });

  it('يُعيد 1 لليوم التالي', () => {
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    expect(daysRemaining(fmt(tomorrow))).toBe(1);
  });

  it('يُعيد سالبًا لتاريخ منتهٍ', () => {
    const past = new Date(today);
    past.setDate(today.getDate() - 10);
    expect(daysRemaining(fmt(past))).toBeLessThan(0);
  });

  it('يُعيد -9999 لـ null', () => {
    expect(daysRemaining(null)).toBe(-9999);
  });

  it('يُعيد -9999 لـ undefined', () => {
    expect(daysRemaining(undefined)).toBe(-9999);
  });

  it('يُعيد -9999 لنص فارغ', () => {
    expect(daysRemaining('')).toBe(-9999);
  });

  it('يُعيد -9999 لتاريخ غير صالح', () => {
    expect(daysRemaining('not-a-date')).toBe(-9999);
  });
});
