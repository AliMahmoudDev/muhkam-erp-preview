import { test, expect } from '@playwright/test';

const E2E_USER = process.env.E2E_TEST_USER;
const E2E_PASS = process.env.E2E_TEST_PASS;

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.fill('[aria-label="اسم المستخدم أو البريد الإلكتروني"]', E2E_USER!);
  await page.fill('[aria-label="الرقم السري"]', E2E_PASS!);
  await page.click('button[type="submit"]');
  await page.waitForURL(/(?!.*login)/, { timeout: 15000 });
}

test('لوحة التحكم تُحمَّل بعد تسجيل الدخول', async ({ page }) => {
  if (!E2E_USER || !E2E_PASS) { test.skip(); return; }
  await login(page);
  await expect(page.getByRole('main')).toBeVisible({ timeout: 10000 });
});

test('الصفحة تستخدم اتجاه RTL', async ({ page }) => {
  if (!E2E_USER || !E2E_PASS) { test.skip(); return; }
  await login(page);
  const rtlEl = page.locator('[dir="rtl"]').first();
  await expect(rtlEl).toBeVisible({ timeout: 10000 });
});

test('شريط التنقل الجانبي مرئي', async ({ page }) => {
  if (!E2E_USER || !E2E_PASS) { test.skip(); return; }
  await login(page);
  const sidebar = page.locator('nav, aside, [role="navigation"]').first();
  await expect(sidebar).toBeVisible({ timeout: 10000 });
});

test('بطاقات KPI مرئية في لوحة التحكم', async ({ page }) => {
  if (!E2E_USER || !E2E_PASS) { test.skip(); return; }
  await login(page);
  const kpiCards = page.locator('[data-kpi], .kpi-card, .stat-card').or(
    page.locator('main .grid > *')
  ).first();
  await expect(kpiCards).toBeVisible({ timeout: 10000 });
});
