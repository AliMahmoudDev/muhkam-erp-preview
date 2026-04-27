import { test, expect } from '@playwright/test';

test('الصفحة الرئيسية تعيد التوجيه إلى صفحة تسجيل الدخول', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/login/);
});

test('كلمة مرور خاطئة تظهر رسالة خطأ بالعربية', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[aria-label="اسم المستخدم أو البريد الإلكتروني"]', 'admin');
  await page.fill('[aria-label="الرقم السري"]', '0000');
  await page.click('button[type="submit"]');
  const errorEl = page.getByRole('alert');
  await expect(errorEl).toBeVisible({ timeout: 10000 });
  const text = await errorEl.textContent();
  expect(text).toMatch(/[\u0600-\u06FF]/);
});

test('تسجيل الدخول بمستخدم وهمي يفشل برسالة عربية', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[aria-label="اسم المستخدم أو البريد الإلكتروني"]', 'مستخدم_وهمي_xyz');
  await page.fill('[aria-label="الرقم السري"]', '9999');
  await page.click('button[type="submit"]');
  const errorEl = page.getByRole('alert');
  await expect(errorEl).toBeVisible({ timeout: 10000 });
  const text = await errorEl.textContent();
  expect(text).toMatch(/[\u0600-\u06FF]/);
});
