import { expect, type Page, test } from '@playwright/test';

const BASE = '/when-again/';

async function bookAndReachShare(
  page: Page,
): Promise<{ link: string; dateKey: string }> {
  await page.goto(BASE);
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

test('the share screen renders a QR and a decodable handoff link', async ({
  page,
}) => {
  const { link } = await bookAndReachShare(page);
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
  const { link } = await bookAndReachShare(page);

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

test('round-trip: book → import → reschedule → cancel, no duplicates', async ({
  page,
}) => {
  // 1. Book and import as new.
  const { link: firstLink, dateKey } = await bookAndReachShare(page);
  await page.goto(firstLink);
  await page.getByRole('button', { name: 'Add appointment' }).click();
  await expect(page.getByRole('heading', { name: 'Added' })).toBeVisible();

  // 2. Provider reschedules the appointment, then re-shares. The appointment
  // was booked on a future day (bookAndReachShare picks the 15th of next
  // month), so returning to the day view needs that day's `?date=` — the
  // bare base URL defaults to "today", which has no appointments.
  await page.goto(`${BASE}?date=${dateKey}`);
  await page.getByTestId('appt-block').first().click();
  await expect(
    page.getByRole('heading', { name: 'Edit appointment' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Change', exact: true }).click();
  await page.getByTestId('free-slot').first().click();
  await page.getByRole('button', { name: 'Save · share' }).click();
  await expect(
    page.getByRole('heading', { name: 'Appointment saved' }),
  ).toBeVisible();
  const changedLink = (
    await page.getByTestId('handoff-link').textContent()
  )?.trim();
  if (!changedLink) throw new Error('expected a handoff link after reschedule');
  expect(changedLink).not.toBe(firstLink); // the time changed → payload changed

  // 3. Client imports the change.
  await page.goto(changedLink);
  await expect(
    page.getByRole('heading', { name: 'Updated appointment' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Update' }).click();
  await expect(page.getByRole('heading', { name: 'Updated' })).toBeVisible();

  // 4. Provider cancels, then re-shares. Same `?date=` reasoning as above —
  // the reschedule (step 2) kept the appointment on the same day, just a
  // different time.
  await page.goto(`${BASE}?date=${dateKey}`);
  await page.getByTestId('appt-block').first().click();
  await page.getByRole('button', { name: 'Cancel appointment' }).click();
  await expect(
    page.getByRole('heading', { name: 'Appointment cancelled' }),
  ).toBeVisible();
  const cancelledLink = (
    await page.getByTestId('handoff-link').textContent()
  )?.trim();
  if (!cancelledLink) throw new Error('expected a handoff link after cancel');

  // 5. Client imports the cancellation.
  await page.goto(cancelledLink);
  await expect(
    page.getByRole('heading', { name: 'Appointment cancelled' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'OK' }).click();
  await expect(page.getByRole('heading', { name: 'Cancelled' })).toBeVisible();

  // 6. No duplicates: exactly one received record, now cancelled.
  const records = await page.evaluate(
    () =>
      new Promise<{ status: string }[]>((resolve, reject) => {
        const req = indexedDB.open('when-again');
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('received', 'readonly');
          const all = tx.objectStore('received').getAll();
          all.onsuccess = () => {
            resolve(all.result);
            db.close();
          };
          all.onerror = () => reject(all.error);
        };
        req.onerror = () => reject(req.error);
      }),
  );
  expect(records.length).toBe(1);
  expect(records[0]?.status).toBe('cancelled');
});
