import { test, expect } from '@playwright/test';

test('قسم الهيرو مرئي عند زيارة الصفحة الرئيسية', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 });
});

test('شريط الإحصاءات يعرض محتوى صحيحاً', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // The stats section sits below the full-height hero; scroll into view so the
  // IntersectionObserver (threshold 0.4) fires and starts the counter animation.
  // page.locator('section').nth(1) is the stats <section ref={statsEl}>.
  await page.locator('section').nth(1).scrollIntoViewIfNeeded();

  // First stat is text-only: "نظام متكامل" — always rendered statically.
  await expect(page.getByText('نظام متكامل').first()).toBeVisible({ timeout: 10000 });

  // The label beneath the first text stat is always rendered statically.
  await expect(page.getByText('حلّ موحّد لكل أقسام شركتك').first()).toBeVisible({ timeout: 10000 });

  // Third stat (index 2) is numeric and animates 0 → 7 over ~1.8 s.
  // .lp-stat-num elements only appear for numeric stats (indices 2 & 3).
  // Allow 8 s total to cover animation + any CI scheduling jitter.
  await expect(page.locator('.lp-stat-num').first()).toHaveText('7', { timeout: 8000 });
});

test('شبكة الميزات تحتوي على 8 بطاقات', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const featuresSection = page.locator('#features');
  await expect(featuresSection).toBeVisible({ timeout: 10000 });

  // The bento grid uses the custom CSS class "lp-bento" — not a Tailwind "grid" class.
  // The BENTO array contains exactly 8 items.
  const cards = featuresSection.locator('.lp-bento > *');
  await expect(cards).toHaveCount(8, { timeout: 10000 });
});

test('زر CTA يؤدي إلى /login', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // The hero and navbar both render a <button> with text "ابدأ مجاناً ←".
  // Clicking either navigates to /login?tab=register (matches /login/).
  const cta = page.getByRole('button', { name: /ابدأ مجاناً/ }).first();
  await expect(cta).toBeVisible({ timeout: 10000 });

  const href = await cta.getAttribute('href');
  if (href) {
    expect(href).toMatch(/login/);
  } else {
    await cta.click();
    await expect(page).toHaveURL(/login/, { timeout: 10000 });
  }
});
