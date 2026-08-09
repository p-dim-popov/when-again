import { expect, test } from '@playwright/test';

const EN_TAGLINE = 'Appointment reminders. No server. No accounts. No fees.';
const BG_TAGLINE = 'Напомняния за часове. Без сървър. Без акаунти. Без такси.';

test('defaults to English and shows the tagline', async ({ page }) => {
  await page.goto('/when-again/settings');
  await expect(page.getByText(EN_TAGLINE)).toBeVisible();
});

test('switching to Bulgarian persists across a reload', async ({ page }) => {
  await page.goto('/when-again/settings');
  await page.getByRole('button', { name: 'БГ' }).click();
  await expect(page.getByText(BG_TAGLINE)).toBeVisible();

  await page.reload();
  await expect(page.getByText(BG_TAGLINE)).toBeVisible();
});
