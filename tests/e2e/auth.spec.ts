import { test, expect } from '@playwright/test';

const E2E_USER = process.env.E2E_TEST_USER;
const E2E_PASS = process.env.E2E_TEST_PASS;

test('زيارة / تعرض صفحة الهبوط مع زر ابدأ تجربتك المجانية', async ({ page }) => {
  await page.goto('/');
  const cta = page.getByRole('link', { name: /ابدأ تجربتك المجانية/ }).or(
    page.getByRole('button', { name: /ابدأ تجربتك المجانية/ })
  ).first();
  await expect(cta).toBeVisible({ timeout: 10000 });
});

test('الضغط على زر البدء يوجه إلى /login', async ({ page }) => {
  await page.goto('/');
  const cta = page.getByRole('link', { name: /ابدأ تجربتك المجانية/ }).or(
    page.getByRole('button', { name: /ابدأ تجربتك المجانية/ })
  ).first();
  await expect(cta).toBeVisible({ timeout: 10000 });
  await cta.click();
  await expect(page).toHaveURL(/login/, { timeout: 10000 });
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

test('بيانات صحيحة تحوّل إلى لوحة التحكم', async ({ page }) => {
  if (!E2E_USER || !E2E_PASS) {
    test.skip();
    return;
  }
  await page.goto('/login');
  await page.fill('[aria-label="اسم المستخدم أو البريد الإلكتروني"]', E2E_USER);
  await page.fill('[aria-label="الرقم السري"]', E2E_PASS);
  await page.click('button[type="submit"]');
  await expect(page).not.toHaveURL(/login/, { timeout: 15000 });
});
