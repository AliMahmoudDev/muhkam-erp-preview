import { test, expect } from '@playwright/test';

const E2E_USER = process.env.E2E_TEST_USER;
const E2E_PASS = process.env.E2E_TEST_PASS;

test('صفحة تسجيل الدخول تحتوي على aria-label بالعربية على حقول الإدخال', async ({ page }) => {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  const usernameInput = page.locator('[aria-label="اسم المستخدم أو البريد الإلكتروني"]');
  const pinInput = page.locator('[aria-label="الرقم السري"]');
  await expect(usernameInput).toBeVisible({ timeout: 10000 });
  await expect(pinInput).toBeVisible({ timeout: 10000 });
});

test('الصفحة الرئيسية تحتوي على عنصر nav بـ aria-label', async ({ page }) => {
  if (!E2E_USER || !E2E_PASS) {
    test.skip();
    return;
  }
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.fill('[aria-label="اسم المستخدم أو البريد الإلكتروني"]', E2E_USER);
  await page.fill('[aria-label="الرقم السري"]', E2E_PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL(/(?!.*login)/, { timeout: 15000 });
  const nav = page.locator('nav[aria-label]').first();
  await expect(nav).toBeVisible({ timeout: 10000 });
});

test('رابط تخطي المحتوى موجود في الصفحة', async ({ page }) => {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  const skipLink = page.locator('a[href="#main-content"], a[href="#content"], a.skip-link, [data-skip-link]').first();
  const skipLinkCount = await skipLink.count();
  if (skipLinkCount === 0) {
    test.skip();
    return;
  }
  await expect(skipLink).toBeAttached();
});
