import { expect, type Page } from '@playwright/test';

// Every fresh Playwright context has an empty IndexedDB, so the first-run
// mode chooser (#7) intercepts every route except /import. Provider-flow
// specs start through this helper.
export async function gotoAsProvider(
  page: Page,
  path = '/when-again/',
): Promise<void> {
  await page.goto(path);
  const chooser = page.getByTestId('chooser-provider');
  const nav = page.getByRole('navigation');
  await expect(chooser.or(nav)).toBeVisible();
  if (await chooser.isVisible()) {
    await chooser.click();
    await expect(nav).toBeVisible();
  }
}

// Canonical provider booking for round-trip specs: set a profile phone (rides
// along as `f`, ADR-0002), book the first free slot on the 15th of next
// month, and land on the share screen. Returns the handoff link and the day
// key used to return to that day's schedule later.
export async function bookAndReachShare(
  page: Page,
  base = '/when-again/',
): Promise<{ link: string; dateKey: string }> {
  await gotoAsProvider(page, base);
  await page.goto(`${base}settings`);
  await page.getByTestId('profile-phone').fill('+359881234567');
  await page.getByTestId('profile-save').click();
  await expect(
    page.getByTestId('profile-section').getByRole('status'),
  ).toHaveText('Saved');
  await page.goto(base);
  await page.getByRole('link', { name: 'New', exact: true }).click();
  await page.getByRole('button', { name: 'Next month' }).click();
  await page.getByRole('button', { name: '15', exact: true }).click();
  await expect(page).toHaveURL(/[?&]date=\d{4}-\d{2}-\d{2}/);
  const dateKey = new URL(page.url()).searchParams.get('date');
  if (!dateKey)
    throw new Error('expected a date search param after picking a day');
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
  return { link, dateKey };
}

// Decode a handoff link's base64url fragment into the raw wire object
// (single-letter keys per src/modules/handoff/codec.ts).
export function decodeWire(link: string): {
  k?: string;
  f?: string;
  t: string;
  r?: number;
} {
  const fragment = link.split('#')[1];
  return JSON.parse(
    Buffer.from(
      fragment.replace(/-/g, '+').replace(/_/g, '/'),
      'base64',
    ).toString('utf8'),
  ) as { k?: string; f?: string; t: string; r?: number };
}
