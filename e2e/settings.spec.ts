import { expect, test } from '@playwright/test';
import { gotoAsProvider } from './helpers';

test('mode switch swaps the tab bar both ways', async ({ page }) => {
  await gotoAsProvider(page, '/when-again/settings');
  await page
    .getByTestId('mode-switch')
    .getByRole('button', { name: 'Client' })
    .click();
  await expect(page.getByRole('link', { name: 'Home' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Today' })).not.toBeVisible();
  await page
    .getByTestId('mode-switch')
    .getByRole('button', { name: 'Provider' })
    .click();
  await expect(page.getByRole('link', { name: 'Today' })).toBeVisible();
});

test('theme choice sets data-theme and survives reload', async ({ page }) => {
  await gotoAsProvider(page, '/when-again/settings');
  await page
    .getByTestId('theme-switch')
    .getByRole('button', { name: 'Dark' })
    .click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page
    .getByTestId('theme-switch')
    .getByRole('button', { name: 'Auto' })
    .click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme');
});

test('provider profile reaches the share payload', async ({ page }) => {
  await gotoAsProvider(page, '/when-again/settings');
  await page.getByTestId('profile-name').fill('Studio X');
  await page.getByTestId('profile-save').click();
  await expect(
    page.getByTestId('profile-section').getByRole('status'),
  ).toHaveText('Saved');

  // Book a minimal appointment the way provider-booking.spec.ts /
  // handoff.spec.ts do, reach /appointment/saved, and assert the share
  // payload carries the provider name.
  await page.getByRole('link', { name: 'New', exact: true }).click();
  await page.getByRole('button', { name: 'Next month' }).click();
  await page.getByRole('button', { name: '15', exact: true }).click();
  await expect(page).toHaveURL(/[?&]date=\d{4}-\d{2}-\d{2}/);
  await page.getByTestId('free-slot').first().click();
  await page.locator('#apptForm-client').fill('Client One');
  await page.locator('#apptForm-service').fill('Haircut');
  await page.locator('#apptForm-duration').fill('30');
  await page.getByRole('button', { name: 'Save · share' }).click();
  await expect(
    page.getByRole('heading', { name: 'Appointment saved' }),
  ).toBeVisible();

  const link = (await page.getByTestId('handoff-link').textContent())?.trim();
  if (!link) throw new Error('expected a handoff link on the share screen');

  // Client side: open the handoff link and confirm the share card shows
  // the provider name from the payload.
  await page.goto(link);
  await expect(
    page.getByRole('heading', { name: 'New appointment' }),
  ).toBeVisible();
  await expect(page.getByText('Studio X')).toBeVisible();
});
