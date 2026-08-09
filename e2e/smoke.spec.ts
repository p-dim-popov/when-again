import { expect, test } from '@playwright/test';

test('the app shell renders the bottom tab bar on /', async ({ page }) => {
  await page.goto('/when-again/');
  await expect(page.getByRole('link', { name: 'Today' })).toBeVisible();
});

test('the page declares the web app manifest', async ({ page }) => {
  await page.goto('/when-again/');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    'href',
    /manifest\.webmanifest/,
  );
});
