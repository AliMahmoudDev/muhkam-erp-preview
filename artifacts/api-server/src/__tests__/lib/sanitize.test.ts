import { describe, it, expect } from 'vitest';
import { sanitizeString, sanitizeObject } from '../../lib/sanitize';

describe('sanitizeString', () => {
  it('يُرجع النص العادي كما هو', () => {
    expect(sanitizeString('مرحبا')).toBe('مرحبا');
  });

  it('يزيل وسوم HTML الخبيثة', () => {
    const result = sanitizeString('<script>alert("xss")</script>بيانات');
    expect(result).not.toContain('<script>');
    expect(result).toContain('بيانات');
  });

  it('يزيل onerror من وسم img', () => {
    const result = sanitizeString('<img src=x onerror=alert(1)>');
    expect(result).not.toContain('onerror');
  });

  it('يزيل المسافات الزائدة من الطرفين', () => {
    expect(sanitizeString('  مرحبا  ')).toBe('مرحبا');
  });

  it('يُرجع نص فارغ بعد trim لنص فراغات فقط', () => {
    expect(sanitizeString('   ')).toBe('');
  });

  it('يُرجع النص الرقمي كما هو', () => {
    expect(sanitizeString('12345')).toBe('12345');
  });

  it('يتعامل مع علامات HTML غير المضرة', () => {
    const result = sanitizeString('السعر: 100 <strong>جنيه</strong>');
    expect(result).toContain('100');
  });
});

describe('sanitizeObject', () => {
  it('ينظّف قيم string داخل الكائن ويزيل المسافات', () => {
    const input = { name: '  علي  ', notes: '<script>evil()</script>ملاحظة' };
    const result = sanitizeObject(input);
    expect(result.name).toBe('علي');
    expect(result.notes).not.toContain('<script>');
    expect(result.notes).toContain('ملاحظة');
  });

  it('يحتفظ بالقيم غير النصية دون تغيير', () => {
    const input = { count: 5, active: true, value: 3.14 };
    const result = sanitizeObject(input as unknown as Record<string, unknown>);
    expect(result.count).toBe(5);
    expect(result.active).toBe(true);
    expect(result.value).toBe(3.14);
  });

  it('يُرجع نسخة جديدة ولا يعدّل الأصل', () => {
    const input = { name: '<script>x</script>' };
    const original = { ...input };
    sanitizeObject(input);
    expect(input.name).toBe(original.name);
  });

  it('يتعامل مع كائن فارغ', () => {
    const result = sanitizeObject({});
    expect(result).toEqual({});
  });

  it('ينظّف قيم متعددة في كائن مختلط', () => {
    const input = {
      username: '  محمد  ',
      age: 30,
      bio: '<script>evil()</script>',
    };
    const result = sanitizeObject(input as unknown as Record<string, unknown>);
    expect(result.username).toBe('محمد');
    expect(result.age).toBe(30);
    expect((result.bio as string)).not.toContain('<script>');
  });
});
