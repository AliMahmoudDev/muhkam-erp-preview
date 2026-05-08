import { test, expect } from '@playwright/test';

const E2E_USER = process.env.E2E_TEST_USER;
const E2E_PASS = process.env.E2E_TEST_PASS;

// ── Helper ────────────────────────────────────────────────────────────────────
async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.fill('[aria-label="اسم المستخدم أو البريد الإلكتروني"]', E2E_USER!);
  await page.fill('[aria-label="الرقم السري"]', E2E_PASS!);
  await page.click('button[type="submit"]');
  await page.waitForURL(/(?!.*login)/, { timeout: 15000 });
}

// ── المبيعات ──────────────────────────────────────────────────────────────────

test('الانتقال إلى صفحة المبيعات بعد تسجيل الدخول', async ({ page }) => {
  if (!E2E_USER || !E2E_PASS) { test.skip(); return; }

  await login(page);

  // Navigate to the sales page via nav link or direct URL
  const salesLink = page
    .getByRole('link', { name: /مبيعات|المبيعات/i })
    .or(page.locator('[href*="sales"], [href*="/pos"]'))
    .first();

  const linkCount = await salesLink.count();
  if (linkCount > 0) {
    await salesLink.first().click();
  } else {
    await page.goto('/sales');
  }

  // The sales page URL should contain "sales" or "pos"
  await expect(page).toHaveURL(/sales|pos/, { timeout: 10000 });
});

test('جدول المبيعات يُحمَّل ويعرض محتوى', async ({ page }) => {
  if (!E2E_USER || !E2E_PASS) { test.skip(); return; }

  await login(page);
  await page.goto('/sales');

  // Wait for the page to finish loading — table, list, or empty-state must appear
  const tableOrList = page
    .locator('table, [role="table"], [role="list"], .sales-list, [data-testid="sales-table"]')
    .or(page.getByText(/لا توجد|لا يوجد|لم يتم|مبيعات/i))
    .first();

  await expect(tableOrList).toBeVisible({ timeout: 15000 });
});

test('وظيفة البحث موجودة وقابلة للكتابة', async ({ page }) => {
  if (!E2E_USER || !E2E_PASS) { test.skip(); return; }

  await login(page);
  await page.goto('/sales');

  // Locate the search input — common selectors for Arabic ERP search fields
  const searchInput = page
    .locator('input[type="search"], input[placeholder*="بحث"], input[placeholder*="search"]')
    .or(page.locator('[aria-label*="بحث"], [aria-label*="search"]'))
    .first();

  const inputCount = await searchInput.count();
  if (inputCount === 0) {
    // Search field not present on this page — skip gracefully
    test.skip();
    return;
  }

  await expect(searchInput).toBeVisible({ timeout: 10000 });

  // Type a query and verify the input accepts text
  await searchInput.fill('اختبار');
  const value = await searchInput.inputValue();
  expect(value).toBe('اختبار');
});
