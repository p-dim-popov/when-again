import { expect, test } from '@playwright/test';

test('the app shell renders the Home screen', async ({ page }) => {
  await page.goto('/when-again/');
  await expect(page.getByRole('heading', { name: 'when-again' })).toBeVisible();
});

test('the page declares the web app manifest', async ({ page }) => {
  await page.goto('/when-again/');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    'href',
    /manifest\.webmanifest/,
  );
});
