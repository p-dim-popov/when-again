import { expect, test } from '@playwright/test';
import { gotoAsProvider } from './helpers';

const EN_TITLE = 'Settings';
const BG_TITLE = 'Настройки';

test('defaults to English', async ({ page }) => {
  await gotoAsProvider(page, '/when-again/settings');
  await expect(page.getByRole('heading', { name: EN_TITLE })).toBeVisible();
});

test('switching to Bulgarian persists across a reload', async ({ page }) => {
  await gotoAsProvider(page, '/when-again/settings');
  await page
    .getByTestId('language-switch')
    .getByRole('button', { name: 'БГ' })
    .click();
  await expect(page.getByRole('heading', { name: BG_TITLE })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: BG_TITLE })).toBeVisible();
});
