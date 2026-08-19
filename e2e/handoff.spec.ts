import { expect, test } from '@playwright/test';
import { bookAndReachShare, decodeWire } from './helpers';

const BASE = '/when-again/';

test('the share screen renders a QR and a decodable handoff link', async ({
  page,
}) => {
  const { link } = await bookAndReachShare(page);
  // QR is an inline SVG inside the share widget.
  await expect(page.locator('svg').first()).toBeVisible();
  expect(link).toMatch(/\/when-again\/import#.+/);

  // The provider id is minted asynchronously (ensureProviderId, a useEffect
  // on the share screen's first mount) and the link's `k` segment only
  // reflects it once that Dexie write settles and the live query re-renders
  // — poll instead of trusting the first textContent() snapshot.
  await expect
    .poll(async () => {
      const current = (
        await page.getByTestId('handoff-link').textContent()
      )?.trim();
      return current ? decodeWire(current).k : undefined;
    })
    .toMatch(/^[0-9a-f-]{36}$/);

  const finalLink = (
    await page.getByTestId('handoff-link').textContent()
  )?.trim();
  if (!finalLink)
    throw new Error('expected a handoff link on the share screen');
  const wire = decodeWire(finalLink);
  expect(wire.f).toBe('+359881234567');
  expect(wire.k).toMatch(/^[0-9a-f-]{36}$/); // minted provider id rides along
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
  await page.getByRole('button', { name: 'Add to calendar' }).click();
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
  await page.getByRole('button', { name: 'Add to calendar' }).click();
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
  await page.getByRole('button', { name: 'Update your calendar' }).click();
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
  await page.getByRole('button', { name: 'Remove from calendar' }).click();
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
