import { expect, test } from '@playwright/test';

test('home page renders and does not scroll sideways', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/Wringy/);

  const viewportWidth = page.viewportSize()?.width;
  expect(viewportWidth).toBeDefined();

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(viewportWidth!);
});
