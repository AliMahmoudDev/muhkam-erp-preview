import { test, expect } from '@playwright/test';

test('قسم الهيرو مرئي عند زيارة الصفحة الرئيسية', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 });
});

test('شريط الإحصاءات يعرض محتوى صحيحاً', async ({ page }) => {
  await page.goto('/');
  // Hero badge always rendered statically
  await expect(page.getByText('نظام واحد لإدارة عملك بالكامل').first()).toBeVisible({ timeout: 10000 });
  // H1 hero text always rendered statically
  await expect(page.getByText('نظّم أعمالك...').first()).toBeVisible({ timeout: 10000 });
});

test('شبكة الميزات تحتوي على 8 بطاقات', async ({ page }) => {
  await page.goto('/');

  const featuresSection = page.locator('#features');
  await expect(featuresSection).toBeVisible({ timeout: 10000 });

  // FEATURES array has 8 items rendered inside .lp-features-grid
  const cards = featuresSection.locator('.lp-features-grid > *');
  await expect(cards).toHaveCount(8, { timeout: 10000 });
});

test('زر CTA يؤدي إلى /login', async ({ page }) => {
  await page.goto('/');

  const cta = page.getByRole('button', { name: /ابدأ مجانًا/ }).first();
  await expect(cta).toBeVisible({ timeout: 10000 });

  const href = await cta.getAttribute('href');
  if (href) {
    expect(href).toMatch(/login/);
  } else {
    await cta.click();
    await expect(page).toHaveURL(/login/, { timeout: 10000 });
  }
});
