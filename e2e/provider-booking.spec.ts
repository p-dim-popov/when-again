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

/** Books ahead: month picker → future day → free quick-slot → form (client
 * name auto-creates on save + service + duration) → Save → landing → Готово.
 * Returns what was booked so callers can assert on it. */
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

  // New name → inline hint; the client is auto-created on save (no tap needed).
  await page.locator('#apptForm-client').fill(clientName);
  await expect(
    page.getByText('New client — will be added when you save.'),
  ).toBeVisible();

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

test('#16: a fresh booking via the month header starts empty after an abandon', async ({
  page,
}) => {
  // Abandon a booking mid-fill: reach the form, type a client, then leave via
  // the bottom nav without saving — the draft now holds a stale name.
  await pickFutureDay(page);
  await firstFreeSlot(page).click();
  await expect(
    page.getByRole('heading', { name: 'New appointment' }),
  ).toBeVisible();
  await page.locator('#apptForm-client').fill('Stale Person');
  await page.getByRole('link', { name: 'Today', exact: true }).click();

  // Start a new booking through the day-view month header (not ＋).
  await page.getByTestId('day-appbar').getByRole('button').nth(1).click(); // month header
  await expect(
    page.getByRole('heading', { name: 'Choose a day' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Next month' }).click();
  await page.getByRole('button', { name: '20', exact: true }).click();
  await firstFreeSlot(page).click();

  // The form is fresh — no stale name.
  await expect(
    page.getByRole('heading', { name: 'New appointment' }),
  ).toBeVisible();
  await expect(page.locator('#apptForm-client')).toHaveValue('');
});

test('#16: a new-booking Промени round-trip preserves typed fields', async ({
  page,
}) => {
  await pickFutureDay(page);
  await firstFreeSlot(page).click();
  await expect(
    page.getByRole('heading', { name: 'New appointment' }),
  ).toBeVisible();
  await page.locator('#apptForm-client').fill('Petar Kolev');
  await page.locator('#apptForm-service').fill('Shave');

  // Change (Промени) → day view → pick another slot → back on the form.
  await page.getByRole('button', { name: 'Change', exact: true }).click();
  await expect(page.getByTestId('day-appbar')).toBeVisible();
  await firstFreeSlot(page).click();

  await expect(
    page.getByRole('heading', { name: 'New appointment' }),
  ).toBeVisible();
  await expect(page.locator('#apptForm-client')).toHaveValue('Petar Kolev');
  await expect(page.locator('#apptForm-service')).toHaveValue('Shave');
});

test('client suggestion list closes after keyboard-selecting an existing client', async ({
  page,
}) => {
  // This combobox has no arrow-key/aria-activedescendant navigation, so Tab
  // is the only keyboard path onto a suggestion option. Guards against a
  // regression where an unconditional blur-dismiss on the input would close
  // the listbox before Tab ever lands on the option.
  const clientName = 'Petya Nikolova';
  await bookAppointment(page, { clientName, service: 'Manicure' });

  await pickFutureDay(page);
  await firstFreeSlot(page).click();
  await expect(
    page.getByRole('heading', { name: 'New appointment' }),
  ).toBeVisible();

  const client = page.locator('#apptForm-client');
  await client.fill(clientName);
  await expect(client).toHaveAttribute('aria-expanded', 'true');

  await page.keyboard.press('Tab');
  const option = page.getByRole('option', { name: clientName, exact: true });
  await expect(option).toBeFocused();
  await page.keyboard.press('Enter');

  // Selected via keyboard → field holds the name and the listbox is closed.
  await expect(client).toHaveValue(clientName);
  await expect(client).toHaveAttribute('aria-expanded', 'false');
});

test('time wheel keeps the selected option inside the highlight band at a large system font', async ({
  page,
}) => {
  await pickFutureDay(page);

  // Simulate a phone with large system text: the rem-based rows and columns
  // grow. 40px is large enough that the earlier bugs strand the selected
  // number outside the band — a fixed 44px row height mis-centred it
  // vertically, and a fixed-px band width let the widened columns push it
  // past the band horizontally (leaving only the ":" visible).
  await page.addStyleTag({ content: 'html { font-size: 40px; }' });

  await page.getByRole('button', { name: 'other time' }).click();
  await expect(page.getByTestId('time-sheet')).toBeVisible();

  const sheet = page.getByTestId('time-sheet');
  const band = sheet.locator('.bg-accent-soft').first();
  const bandBox = await band.boundingBox();
  if (!bandBox) throw new Error('expected the highlight band to be laid out');

  // Both columns' selected numbers must sit inside the band on BOTH axes —
  // horizontal containment is the axis the first regression test missed.
  for (const columnName of ['Hours', 'Minutes'] as const) {
    const selected = page
      .getByRole('listbox', { name: columnName })
      .getByRole('option', { selected: true });
    const selBox = await selected.boundingBox();
    if (!selBox)
      throw new Error(`expected ${columnName} selected option to be laid out`);

    const selCx = selBox.x + selBox.width / 2;
    const selCy = selBox.y + selBox.height / 2;
    expect(selCx).toBeGreaterThanOrEqual(bandBox.x);
    expect(selCx).toBeLessThanOrEqual(bandBox.x + bandBox.width);
    expect(Math.abs(selCy - (bandBox.y + bandBox.height / 2))).toBeLessThan(6);
  }
});

test('#21: save-time clash check blocks a new appointment whose duration overruns the next', async ({
  page,
}) => {
  // Book A at 09:00 (30 min) via the "other time" sheet, leaving 08:00 free
  // in front of it. (bookAppointment always takes 08:00, so A is placed by
  // hand here.)
  const dateKey = await pickFutureDay(page);
  await page.getByRole('button', { name: 'other time' }).click();
  await expect(page.getByTestId('time-sheet')).toBeVisible();
  await page
    .getByRole('listbox', { name: 'Hours' })
    .getByRole('option', { name: '09', exact: true })
    .click();
  await page.getByRole('button', { name: 'Choose · 09:00' }).click();
  await expect(
    page.getByRole('heading', { name: 'New appointment' }),
  ).toBeVisible();
  await page.locator('#apptForm-client').fill('Anna');
  await page.locator('#apptForm-service').fill('Color');
  await page.locator('#apptForm-duration').fill('30');
  await page.getByRole('button', { name: 'Save · share' }).click();
  await expect(
    page.getByRole('heading', { name: 'Appointment saved' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page).toHaveURL(new RegExp(`date=${dateKey}`));

  // Start B at the first free slot (08:00) but type 90 min → 08:00–09:30,
  // which overruns into A (09:00–09:30). The pick-time bound sized 08:00 for a
  // 30-min service, so only the save-time check can catch this.
  const slot = firstFreeSlot(page);
  await expect(slot).toHaveText('08:00');
  await slot.click();
  await expect(
    page.getByRole('heading', { name: 'New appointment' }),
  ).toBeVisible();
  await page.locator('#apptForm-client').fill('Boris');
  await page.locator('#apptForm-service').fill('Cut');
  await page.locator('#apptForm-duration').fill('90');
  await page.getByRole('button', { name: 'Save · share' }).click();

  // Blocked: still on the form, the inline error names A, and no save landing.
  await expect(
    page.getByText('This overlaps the 09:00 appointment (Color).', {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Appointment saved' }),
  ).toHaveCount(0);

  // Shorten to 30 min (08:00–08:30, fits) → the same Save now succeeds.
  await page.locator('#apptForm-duration').fill('30');
  await page.getByRole('button', { name: 'Save · share' }).click();
  await expect(
    page.getByRole('heading', { name: 'Appointment saved' }),
  ).toBeVisible();
});

test('#21: save-time clash check blocks an edit whose new duration overruns the next', async ({
  page,
}) => {
  // A at 08:00 (30 min) via the shared helper, then B at 08:30 (30 min) — the
  // next free slot — so the two are back-to-back (08:00–08:30, 08:30–09:00).
  const { dateKey } = await bookAppointment(page, {
    clientName: 'Cveti',
    service: 'Wash',
  });
  await pickFutureDay(page); // same deterministic day (the 15th)
  const bSlot = firstFreeSlot(page);
  await expect(bSlot).toHaveText('08:30');
  await bSlot.click();
  await page.locator('#apptForm-client').fill('Diana');
  await page.locator('#apptForm-service').fill('Trim');
  await page.locator('#apptForm-duration').fill('30');
  await page.getByRole('button', { name: 'Save · share' }).click();
  await expect(
    page.getByRole('heading', { name: 'Appointment saved' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page).toHaveURL(new RegExp(`date=${dateKey}`));

  // Edit A (first block) and stretch it to 60 min → 08:00–09:00 overruns into
  // B (08:30–09:00). Save must be blocked, naming B; A must NOT self-clash.
  await page.getByTestId('appt-block').first().click();
  await expect(
    page.getByRole('heading', { name: 'Edit appointment' }),
  ).toBeVisible();
  await page.locator('#apptForm-duration').fill('60');
  await page.getByRole('button', { name: 'Save · share' }).click();

  await expect(
    page.getByText('This overlaps the 08:30 appointment (Trim).', {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Appointment saved' }),
  ).toHaveCount(0);

  // Back to a fitting 30 min → the edit saves.
  await page.locator('#apptForm-duration').fill('30');
  await page.getByRole('button', { name: 'Save · share' }).click();
  await expect(
    page.getByRole('heading', { name: 'Appointment saved' }),
  ).toBeVisible();
});
