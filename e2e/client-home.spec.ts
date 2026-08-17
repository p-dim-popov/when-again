import { expect, test } from '@playwright/test';
// Deep import on purpose: the handoff index re-exports React screens, which
// must not load in the Playwright node process. The codec is pure.
import { encodeHandoff } from '../src/modules/handoff/codec';

const BASE = '/when-again/';

function futureDateTime(daysAhead: number, time: string): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${time}`;
}

function importUrl(over: Partial<Parameters<typeof encodeHandoff>[0]> = {}) {
  return `${BASE}import#${encodeHandoff({
    id: 'e2e-appt-1',
    providerName: 'Студио Мария',
    address: 'ул. Роза 5',
    service: 'Подстригване',
    start: { dateTime: futureDateTime(3, '15:00'), timeZone: 'Europe/Sofia' },
    durationMinutes: 30,
    status: 'booked',
    providerId: 'e2e-prov-1',
    phone: '+359881234567',
    ...over,
  })}`;
}

test('import lands a fresh profile on the big-card home', async ({ page }) => {
  await page.goto(importUrl());
  await page.getByRole('button', { name: 'Add appointment' }).click();
  await page.getByRole('button', { name: 'Done' }).click();

  const card = page.getByTestId('next-visit-card');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Подстригване');
  await expect(card).toContainText('Студио Мария');
  await expect(card).toContainText(
    /In \d+ day|Today at|Tomorrow at|In \d+ min/,
  );
  await expect(card.locator('a[href^="tel:"]')).toHaveAttribute(
    'href',
    'tel:+359881234567',
  );
  // Client tab bar has three tabs now.
  await expect(page.getByRole('navigation').getByRole('link')).toHaveCount(3);
});

test('providers tab lists the salon; delete removes salon and visits', async ({
  page,
}) => {
  await page.goto(importUrl());
  await page.getByRole('button', { name: 'Add appointment' }).click();
  await page.getByRole('button', { name: 'Done' }).click();

  await page.goto(`${BASE}providers`);
  const card = page.getByTestId('provider-card');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Студио Мария');
  await expect(card).toContainText('ул. Роза 5');

  await page.getByTestId('provider-delete').click();
  await page.getByTestId('provider-delete-confirm').click();
  await expect(page.getByTestId('providers-empty')).toBeVisible();

  await page.goto(BASE);
  await expect(page.getByTestId('next-visit-empty')).toBeVisible();
  await expect(page.getByTestId('client-visit')).toHaveCount(0);
});

test('a payload without provider id groups under the synthetic record', async ({
  page,
}) => {
  await page.goto(importUrl({ providerId: undefined, phone: undefined }));
  await page.getByRole('button', { name: 'Add appointment' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.goto(`${BASE}providers`);
  await expect(page.getByTestId('provider-card')).toContainText('Студио Мария');
});
