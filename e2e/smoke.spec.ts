import { type Browser, expect, test } from '@playwright/test';
import { gotoAsProvider } from './helpers';

// Same booking steps as handoff.spec.ts's `bookAndReachShare`, run in an
// isolated browser context (its own storage) so building the share link
// doesn't set provider mode on the primary test page.
async function buildShareUrl(browser: Browser): Promise<string> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await gotoAsProvider(page, '/when-again/');
  await page.getByRole('link', { name: 'New', exact: true }).click();
  await page.getByRole('button', { name: 'Next month' }).click();
  await page.getByRole('button', { name: '15', exact: true }).click();
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
  await context.close();
  return link;
}

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
  await expect(page.getByRole('heading', { name: 'When Again' })).toBeVisible();
  await page.getByTestId('chooser-client').click();
  await expect(page.getByTestId('client-home')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('client-home')).toBeVisible();
  await expect(page.getByTestId('chooser-provider')).not.toBeVisible();
});

test('import-first flow infers client mode without showing the chooser', async ({
  page,
  browser,
}) => {
  const shareUrl = await buildShareUrl(browser);

  await page.goto(shareUrl); // /when-again/import#… — no chooser here
  await expect(page.getByTestId('chooser-provider')).not.toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'New appointment' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Add appointment' }).click();
  await expect(page.getByRole('heading', { name: 'Added' })).toBeVisible();

  await page.goto('/when-again/');
  await expect(page.getByTestId('client-home')).toBeVisible();
});

test('a client deep-linking a provider route is sent home', async ({
  page,
}) => {
  await page.goto('/when-again/');
  await page.getByTestId('chooser-client').click();
  await expect(page.getByTestId('client-home')).toBeVisible();
  await page.goto('/when-again/book');
  await expect(page.getByTestId('client-home')).toBeVisible(); // redirected
});
