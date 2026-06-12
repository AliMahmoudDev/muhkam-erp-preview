import { test, expect } from '@playwright/test';

const E2E_USER = process.env.E2E_TEST_USER;
const E2E_PASS = process.env.E2E_TEST_PASS;

// ── Helper ────────────────────────────────────────────────────────────────────
async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.fill('[aria-label="رقم الهاتف أو اسم المستخدم"]', E2E_USER!);
  await page.fill('[aria-label="الرقم السري"]', E2E_PASS!);
  await page.click('button[type="submit"]');
  await page.waitForURL(/(?!.*login)/, { timeout: 15000 });
}

// ── صفحة تسجيل الدخول ────────────────────────────────────────────────────────

test('صفحة /login تعرض واجهة عربية RTL', async ({ page }) => {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  // Wait for the form to be fully rendered before inspecting content.
  // The login page injects its CSS into <head> via useEffect, so checking
  // body.textContent is unreliable — query the form element instead.
  const usernameInput = page.locator('[aria-label="رقم الهاتف أو اسم المستخدم"]');
  await expect(usernameInput).toBeVisible({ timeout: 10000 });

  // The root wrapper declares RTL direction
  const rtlEl = page.locator('[dir="rtl"]').first();
  await expect(rtlEl).toBeVisible({ timeout: 10000 });

  // Arabic text must exist inside the rendered form (not the whole body)
  const formText = await page.locator('form').first().textContent();
  expect(formText).toMatch(/[\u0600-\u06FF]/);
});

test('كلمة مرور خاطئة تظهر رسالة خطأ بالعربية', async ({ page }) => {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('[aria-label="رقم الهاتف أو اسم المستخدم"]')).toBeVisible({ timeout: 10000 });

  await page.fill('[aria-label="رقم الهاتف أو اسم المستخدم"]', 'admin');
  await page.fill('[aria-label="الرقم السري"]', '0000');
  await page.click('button[type="submit"]');

  const errorEl = page.getByRole('alert');
  await expect(errorEl).toBeVisible({ timeout: 10000 });
  const text = await errorEl.textContent();
  expect(text).toMatch(/[\u0600-\u06FF]/);
});

test('بيانات صحيحة تحوّل إلى لوحة التحكم', async ({ page }) => {
  if (!E2E_USER || !E2E_PASS) { test.skip(); return; }

  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.fill('[aria-label="رقم الهاتف أو اسم المستخدم"]', E2E_USER);
  await page.fill('[aria-label="الرقم السري"]', E2E_PASS);
  await page.click('button[type="submit"]');
  await expect(page).not.toHaveURL(/login/, { timeout: 15000 });
});

test('تسجيل الخروج يعيد التوجيه إلى /login', async ({ page }) => {
  if (!E2E_USER || !E2E_PASS) { test.skip(); return; }

  await login(page);

  const logoutBtn = page
    .getByRole('button', { name: /خروج|تسجيل الخروج|logout/i })
    .or(page.locator('[data-logout], [aria-label*="خروج"], [aria-label*="logout"]'))
    .first();

  await expect(logoutBtn).toBeVisible({ timeout: 10000 });
  await logoutBtn.click();

  await expect(page).toHaveURL(/login/, { timeout: 10000 });
});

// ── الصفحة الرئيسية (landing) ─────────────────────────────────────────────────
// The actual CTA text in the hero and navbar is "ابدأ مجاناً ←".
// "ابدأ تجربتك المجانية" only appears inside the mobile hamburger menu
// (which is hidden at the 1280 × 720 desktop viewport used in these tests).

test('زيارة / تعرض صفحة الهبوط مع زر البدء', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const cta = page.getByRole('button', { name: /ابدأ مجاناً/ }).first();
  await expect(cta).toBeVisible({ timeout: 10000 });
});

test('الضغط على زر البدء يوجه إلى /login', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const cta = page.getByRole('button', { name: /ابدأ مجاناً/ }).first();
  await expect(cta).toBeVisible({ timeout: 10000 });
  await cta.click();
  await expect(page).toHaveURL(/login/, { timeout: 10000 });
});
