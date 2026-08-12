import { expect, test } from '@playwright/test';
import { gotoAsProvider } from './helpers';

test('the app shell renders the bottom tab bar on /', async ({ page }) => {
  await gotoAsProvider(page);
  await expect(page.getByRole('link', { name: 'Today' })).toBeVisible();
});

test('the page declares the web app manifest', async ({ page }) => {
  await gotoAsProvider(page);
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    'href',
    /manifest\.webmanifest/,
  );
});

test('settings shows the build stamp', async ({ page }) => {
  await gotoAsProvider(page, '/when-again/settings');
  await expect(
    page.getByText(/\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC · [0-9a-f]{7,}/),
  ).toBeVisible();
});

test('first run shows the mode chooser and the choice persists', async ({
  page,
}) => {
  await page.goto('/when-again/');
  await expect(page.getByTestId('chooser-provider')).toBeVisible();
  await page.getByTestId('chooser-client').click();
  await expect(page.getByTestId('client-home')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('client-home')).toBeVisible();
  await expect(page.getByTestId('chooser-provider')).not.toBeVisible();
});
