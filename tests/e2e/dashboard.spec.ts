import { test, expect } from '@playwright/test';

const E2E_USER = process.env.E2E_TEST_USER;
const E2E_PASS = process.env.E2E_TEST_PASS;

test('بعد تسجيل الدخول، لوحة التحكم تحتوي على عنصر بـ role=main', async ({ page }) => {
  if (!E2E_USER || !E2E_PASS) {
    test.skip();
    return;
  }
  await page.goto('/login');
  await page.fill('[aria-label="اسم المستخدم أو البريد الإلكتروني"]', E2E_USER);
  await page.fill('[aria-label="الرقم السري"]', E2E_PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL(/(?!.*login)/, { timeout: 15000 });
  await expect(page.getByRole('main')).toBeVisible({ timeout: 10000 });
});

test('الصفحة تستخدم اتجاه RTL', async ({ page }) => {
  if (!E2E_USER || !E2E_PASS) {
    test.skip();
    return;
  }
  await page.goto('/login');
  await page.fill('[aria-label="اسم المستخدم أو البريد الإلكتروني"]', E2E_USER);
  await page.fill('[aria-label="الرقم السري"]', E2E_PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL(/(?!.*login)/, { timeout: 15000 });
  const rtlEl = page.locator('[dir="rtl"]').first();
  await expect(rtlEl).toBeVisible({ timeout: 10000 });
});
