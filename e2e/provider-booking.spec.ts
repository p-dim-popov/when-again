import { expect, type Page, test } from '@playwright/test';

// Acceptance test for Epic 4 (provider mode — schedule & appointments).
// Follows the "Design update" flows at the bottom of
// docs/plans/2026-08-09-epic-4-provider-schedule.md: time picking (quick
// slots AND "друг час") happens on the day view, never inside the form; the
// form's "Change" (Промени) round-trips back to the day view to re-pick.
//
// Language: e2e/i18n.spec.ts proves the app defaults to ENGLISH in the
// Playwright browser, so this spec asserts the English copy from each
// module's strings.ts (shell/schedule/booking) rather than Bulgarian, and
// prefers role/structure-based selectors over exact text where practical.
//
// Determinism: every day picked comes from tapping "Next month" once in the
// month picker, then a fixed day-of-month (15) — always a future day
// relative to "today", whatever today happens to be, and never a hardcoded
// absolute date.
//
// Isolation: each `test()` starts from a fresh browser context (Playwright's
// default), so IndexedDB is empty at the start of every test. Test 3 needs an
// appointment to edit/cancel, so it books one itself as its first step rather
// than depending on another test's data.

const BASE = '/when-again/';

/** Opens the month picker via the bottom bar's ＋ New tab, advances one
 * month (always future relative to "today"), and picks the 15th — a day
 * that is guaranteed free (fresh IndexedDB) and guaranteed in the future.
 * Returns the resulting day's `'YYYY-MM-DD'` key, read back off the URL. */
async function pickFutureDay(page: Page): Promise<string> {
  await page.goto(BASE);
  await page.getByRole('link', { name: 'New', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Choose a day' }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Next month' }).click();
  await page.getByRole('button', { name: '15', exact: true }).click();

  await expect(page).toHaveURL(/[?&]date=\d{4}-\d{2}-\d{2}/);
  const dateKey = new URL(page.url()).searchParams.get('date');
  if (!dateKey)
    throw new Error('expected a date search param after picking a day');
  return dateKey;
}

/** First free (non-more, non-"other time") quick-slot chip on the day
 * currently shown. */
function firstFreeSlot(page: Page) {
  return page.getByTestId('free-slot').first();
}

/** Books ahead: month picker → future day → free quick-slot → form (inline
 * client create + service + duration) → Save → landing → Готово. Returns
 * what was booked so callers can assert on it. */
async function bookAppointment(
  page: Page,
  { clientName, service }: { clientName: string; service: string },
): Promise<{ dateKey: string; time: string }> {
  const dateKey = await pickFutureDay(page);

  const slot = firstFreeSlot(page);
  const time = (await slot.textContent())?.trim();
  if (!time) throw new Error('expected a free quick-slot chip on a fresh day');
  await slot.click();

  await expect(
    page.getByRole('heading', { name: 'New appointment' }),
  ).toBeVisible();
  await expect(page.getByText(time)).toBeVisible();

  await page.locator('#apptForm-client').fill(clientName);
  // The inline "Create '<name>'" suggestion carries `role="option"` (it's a
  // member of the client-search listbox — see AppointmentForm.tsx) which
  // overrides its host `<button>`'s implicit role, so it resolves by the
  // "option" role rather than "button".
  await page.getByRole('option', { name: `Create "${clientName}"` }).click();

  await page.locator('#apptForm-service').fill(service);
  await page.locator('#apptForm-duration').fill('30');

  await page.getByRole('button', { name: 'Save · share' }).click();

  await expect(
    page.getByRole('heading', { name: 'Appointment saved' }),
  ).toBeVisible();
  await expect(page.getByText(clientName)).toBeVisible();
  await expect(page.getByText(service)).toBeVisible();

  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page).toHaveURL(new RegExp(`date=${dateKey}`));

  return { dateKey, time };
}

test('books an appointment ahead of time via the month picker and a quick slot', async ({
  page,
}) => {
  const clientName = 'Ivana Petrova';
  const service = 'Haircut';

  await bookAppointment(page, { clientName, service });

  const block = page.getByTestId('appt-block').first();
  await expect(block).toBeVisible();
  await expect(block).toContainText(clientName);
  await expect(block).toContainText(service);
});

test("другчас: the day view's inline time sheet carries an off-grid time to the form", async ({
  page,
}) => {
  await pickFutureDay(page);

  // The gap chip labelled "◷ other time" opens a bottom sheet OVER the day
  // view (not inside the form) — the key design-update behaviour.
  await page.getByRole('button', { name: 'other time' }).click();
  await expect(page.getByTestId('time-sheet')).toBeVisible();

  // The wheel opens on 08:00 (day start).
  await expect(
    page.getByRole('button', { name: 'Choose · 08:00' }),
  ).toBeVisible();

  // Push the minute to :55 (valid at 08:00), then switch the hour to the
  // day's last hour (19:00) via the Hours listbox. The day window is
  // 08:00–20:00 and the free-slot service is 30 minutes, so 19:00's latest
  // valid start is 19:30 — the minute column must re-clamp :55 down to :30
  // via `nearestMinute` rather than carry over an invalid 19:55.
  await page
    .getByRole('listbox', { name: 'Minutes' })
    .getByRole('option', { name: '55', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Choose · 08:55' }),
  ).toBeVisible();

  await page
    .getByRole('listbox', { name: 'Hours' })
    .getByRole('option', { name: '19', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Choose · 19:30' }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('listbox', { name: 'Minutes' })
      .getByRole('option', { name: '55', exact: true }),
  ).toHaveCount(0);

  // Switch back to hour 08 and pick the :05 minute option to nudge one step
  // off the 30-minute quick-slot grid, then confirm.
  await page
    .getByRole('listbox', { name: 'Hours' })
    .getByRole('option', { name: '08', exact: true })
    .click();
  await page
    .getByRole('listbox', { name: 'Minutes' })
    .getByRole('option', { name: '05', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Choose · 08:05' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Choose · 08:05' }).click();

  await expect(
    page.getByRole('heading', { name: 'New appointment' }),
  ).toBeVisible();
  await expect(page.getByText('08:05')).toBeVisible();
});

test('edit, reschedule, and cancel an existing appointment', async ({
  page,
}) => {
  const clientName = 'Georgi Ivanov';
  const service = 'Beard trim';
  const { time: originalTime } = await bookAppointment(page, {
    clientName,
    service,
  });

  // Tap the appointment block: the form opens in edit mode.
  await page.getByTestId('appt-block').first().click();
  await expect(
    page.getByRole('heading', { name: 'Edit appointment' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Cancel appointment' }),
  ).toBeVisible();
  await expect(page.locator('#apptForm-client')).toHaveValue(clientName);
  await expect(page.locator('#apptForm-service')).toHaveValue(service);

  // "Change" (Промени) returns to the day view — the URL carries `appt` so
  // the round trip stays an edit rather than starting a new booking.
  await page.getByRole('button', { name: 'Change', exact: true }).click();
  await expect(page).toHaveURL(/appt=/);
  await expect(page.getByTestId('day-appbar')).toBeVisible();

  // The originally-booked time is now occupied, so the next free chip is a
  // different time. Pick it.
  const slot = firstFreeSlot(page);
  const rescheduledTime = (await slot.textContent())?.trim();
  if (!rescheduledTime) {
    throw new Error(
      'expected a free quick-slot chip after the original one was booked',
    );
  }
  expect(rescheduledTime).not.toBe(originalTime);
  await slot.click();

  // Back on the form, still editing — earlier field edits preserved.
  await expect(
    page.getByRole('heading', { name: 'Edit appointment' }),
  ).toBeVisible();
  await expect(page.locator('#apptForm-client')).toHaveValue(clientName);
  await expect(page.locator('#apptForm-service')).toHaveValue(service);
  await expect(page.getByText(rescheduledTime)).toBeVisible();

  await page.getByRole('button', { name: 'Save · share' }).click();
  await expect(
    page.getByRole('heading', { name: 'Appointment saved' }),
  ).toBeVisible();
  await expect(page.getByText(rescheduledTime)).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();

  const rescheduledBlock = page.getByTestId('appt-block').first();
  await expect(rescheduledBlock).toContainText(clientName);
  await expect(page.getByTestId('appt-cancelled')).toHaveCount(0);

  // Tap it again, then cancel.
  await rescheduledBlock.click();
  await expect(
    page.getByRole('heading', { name: 'Edit appointment' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Cancel appointment' }).click();

  await expect(
    page.getByRole('heading', { name: 'Appointment cancelled' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();

  // Still present on the day, but de-emphasised — not removed.
  const cancelledAppt = page.getByTestId('appt-cancelled');
  await expect(cancelledAppt).toBeVisible();
  await expect(cancelledAppt).toContainText(clientName);
  await expect(cancelledAppt).toContainText('Cancelled');
});

test('client suggestion list closes after picking an existing client', async ({
  page,
}) => {
  const clientName = 'Maria Dimitrova';
  await bookAppointment(page, { clientName, service: 'Color' });

  // Start a second booking, type the same name → the existing client appears.
  await pickFutureDay(page);
  await firstFreeSlot(page).click();
  await expect(
    page.getByRole('heading', { name: 'New appointment' }),
  ).toBeVisible();

  const client = page.locator('#apptForm-client');
  await client.fill(clientName);
  await expect(client).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('option', { name: clientName, exact: true }).click();

  // Picked → field holds the name and the listbox is closed.
  await expect(client).toHaveValue(clientName);
  await expect(client).toHaveAttribute('aria-expanded', 'false');
});
