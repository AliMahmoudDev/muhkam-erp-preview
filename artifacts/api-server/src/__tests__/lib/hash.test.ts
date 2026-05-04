import { describe, it, expect } from 'vitest';
import { hashPin, verifyPin, isHashed } from '../../lib/hash';

describe('isHashed', () => {
  it('يتعرف على bcrypt hash صحيح ($2b$)', () => {
    const bcryptHash = '$2b$10$abcdefghijklmnopqrstuvuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuu';
    expect(isHashed(bcryptHash)).toBe(true);
  });

  it('يتعرف على bcrypt hash صحيح ($2a$)', () => {
    const bcryptHash = '$2a$10$abcdefghijklmnopqrstuvuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuu';
    expect(isHashed(bcryptHash)).toBe(true);
  });

  it('يرفض PIN عادي قصير', () => {
    expect(isHashed('1234')).toBe(false);
  });

  it('يرفض نص طويل لا يبدأ بـ $2', () => {
    const longString = 'a'.repeat(60);
    expect(isHashed(longString)).toBe(false);
  });

  it('يرفض نص فارغ', () => {
    expect(isHashed('')).toBe(false);
  });
});

describe('hashPin + verifyPin', () => {
  it('يُنتج hash مختلف عن PIN الأصلي', { timeout: 15000 }, async () => {
    const hash = await hashPin('1234');
    expect(hash).not.toBe('1234');
    expect(isHashed(hash)).toBe(true);
  });

  it('يتحقق من PIN صحيح مقابل bcrypt hash', { timeout: 15000 }, async () => {
    const hash = await hashPin('5678');
    const result = await verifyPin('5678', hash);
    expect(result).toBe(true);
  });

  it('يرفض PIN خاطئ مقابل bcrypt hash', { timeout: 15000 }, async () => {
    const hash = await hashPin('5678');
    const result = await verifyPin('0000', hash);
    expect(result).toBe(false);
  });

  it('يدعم legacy plain-text PIN (نص أقل من 60 حرف)', async () => {
    const result = await verifyPin('9999', '9999');
    expect(result).toBe(true);
  });

  it('يرفض legacy PIN خاطئ', async () => {
    const result = await verifyPin('0000', '9999');
    expect(result).toBe(false);
  });

  it('يرفض PIN فارغ', { timeout: 15000 }, async () => {
    const hash = await hashPin('1234');
    expect(await verifyPin('', hash)).toBe(false);
  });

  it('يرفض stored فارغ', async () => {
    expect(await verifyPin('1234', '')).toBe(false);
  });
});
