import { expect, type Page, test } from '@playwright/test';

const BASE = '/when-again/';

async function bookAndReachShare(page: Page): Promise<string> {
  await page.goto(BASE);
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
  return link;
}

test('the share screen renders a QR and a decodable handoff link', async ({
  page,
}) => {
  const link = await bookAndReachShare(page);
  // QR is an inline SVG inside the share widget.
  await expect(page.locator('svg').first()).toBeVisible();
  expect(link).toMatch(/\/when-again\/import#.+/);
});

test('import: empty and invalid links show calm states', async ({ page }) => {
  await page.goto(`${BASE}import`);
  await expect(page.getByText('Nothing to import.')).toBeVisible();

  await page.goto(`${BASE}import#not-valid-base64!!`);
  await expect(page.getByText("This link isn't valid.")).toBeVisible();
});

test('import: new → add → re-open shows up to date (idempotent)', async ({
  page,
}) => {
  const link = await bookAndReachShare(page);

  await page.goto(link);
  await expect(
    page.getByRole('heading', { name: 'New appointment' }),
  ).toBeVisible();
  await expect(page.getByText('Haircut')).toBeVisible();
  await page.getByRole('button', { name: 'Add appointment' }).click();
  await expect(page.getByRole('heading', { name: 'Added' })).toBeVisible();

  // Re-opening the same link is idempotent.
  await page.goto(link);
  await expect(
    page.getByRole('heading', { name: 'Already added' }),
  ).toBeVisible();
});
