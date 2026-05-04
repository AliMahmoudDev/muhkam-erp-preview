import { describe, it, expect } from 'vitest';
import { translateRole } from '@/lib/roles';

describe('translateRole', () => {
  it('يترجم super_admin', () => {
    expect(translateRole('super_admin')).toBe('المسؤول العام');
  });

  it('يترجم admin', () => {
    expect(translateRole('admin')).toBe('مدير النظام');
  });

  it('يترجم manager', () => {
    expect(translateRole('manager')).toBe('مشرف');
  });

  it('يترجم cashier', () => {
    expect(translateRole('cashier')).toBe('كاشير');
  });

  it('يترجم salesperson', () => {
    expect(translateRole('salesperson')).toBe('مندوب مبيعات');
  });

  it('يترجم company_admin', () => {
    expect(translateRole('company_admin')).toBe('مدير الشركة');
  });

  it('يترجم branch_manager', () => {
    expect(translateRole('branch_manager')).toBe('مدير الفرع');
  });

  it('يترجم agent', () => {
    expect(translateRole('agent')).toBe('موظف مبيعات');
  });

  it('يترجم client', () => {
    expect(translateRole('client')).toBe('عميل');
  });

  it('يُرجع النص كما هو عند دور غير معروف', () => {
    expect(translateRole('unknown_role')).toBe('unknown_role');
  });

  it('يُرجع نص فارغ لدور فارغ', () => {
    expect(translateRole('')).toBe('');
  });
});
