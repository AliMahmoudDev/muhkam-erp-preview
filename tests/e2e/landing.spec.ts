import { test, expect } from '@playwright/test';

test('قسم الهيرو مرئي عند زيارة الصفحة الرئيسية', async ({ page }) => {
  await page.goto('/');
  const hero = page.locator('section').first().or(page.locator('[data-section="hero"], .hero, #hero')).first();
  await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 });
});

test('شريط الإحصاءات يعرض +500 شركة', async ({ page }) => {
  await page.goto('/');
  const statsText = page.getByText(/\+?500/);
  await expect(statsText.first()).toBeVisible({ timeout: 10000 });
  const companiesText = page.getByText(/شركة/);
  await expect(companiesText.first()).toBeVisible({ timeout: 10000 });
});

test('شبكة الميزات تحتوي على 9 بطاقات', async ({ page }) => {
  await page.goto('/');
  const featuresSection = page.locator('#features');
  await expect(featuresSection).toBeVisible({ timeout: 10000 });
  const cards = featuresSection.locator('.grid > *');
  await expect(cards).toHaveCount(9, { timeout: 10000 });
});

test('زر CTA يؤدي إلى /login', async ({ page }) => {
  await page.goto('/');
  const cta = page.getByRole('link', { name: /ابدأ تجربتك المجانية/ }).or(
    page.getByRole('button', { name: /ابدأ تجربتك المجانية/ })
  ).first();
  await expect(cta).toBeVisible({ timeout: 10000 });
  const href = await cta.getAttribute('href');
  if (href) {
    expect(href).toMatch(/login/);
  } else {
    await cta.click();
    await expect(page).toHaveURL(/login/, { timeout: 10000 });
  }
});
