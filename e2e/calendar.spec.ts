import { readFileSync } from 'node:fs';
import { expect, type Locator, type Page, test } from '@playwright/test';
import { bookAndReachShare, decodeWire } from './helpers';

const BASE = '/when-again/';

// Headless Chromium has no `navigator.share`, so the calendar action always
// takes the blob-anchor fallback — the click fires a real download whose
// bytes are the generated .ics. That is the point: these specs prove the
// real click path hands over a well-formed file (UID stable across flows,
// SEQUENCE increments, STATUS:CANCELLED on cancel). Byte-level RFC facts
// (folding, escaping, VALARMs) are owned by src/modules/ics/ics.test.ts.
async function clickAndCaptureIcs(
  page: Page,
  button: Locator,
): Promise<{ fileName: string; lines: string[] }> {
  const downloadPromise = page.waitForEvent('download');
  await button.click();
  const download = await downloadPromise;
  const path = await download.path();
  return {
    fileName: download.suggestedFilename(),
    lines: readFileSync(path, 'utf8').split('\r\n'),
  };
}

function uidLine(lines: string[]): string {
  const line = lines.find((l) => l.startsWith('UID:'));
  if (!line) throw new Error('expected a UID line in the downloaded .ics');
  return line;
}

// Provider reschedules the booked appointment to the day's first free slot
// and reshares. Polls the handoff link until the bumped revision (`r`) is in
// the payload — the share screen's live query may re-render after the first
// textContent() snapshot (same reasoning as the provider-id poll in
// handoff.spec.ts).
async function rescheduleAndReachShare(
  page: Page,
  dateKey: string,
  revision: number,
): Promise<string> {
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
  return shareLinkAtRevision(page, revision);
}

async function shareLinkAtRevision(
  page: Page,
  revision: number,
): Promise<string> {
  await expect
    .poll(async () => {
      const current = (
        await page.getByTestId('handoff-link').textContent()
      )?.trim();
      return current ? decodeWire(current).r : undefined;
    })
    .toBe(revision);
  const link = (await page.getByTestId('handoff-link').textContent())?.trim();
  if (!link) throw new Error('expected a handoff link on the share screen');
  return link;
}

test('calendar story: add on import, home-card export, update on reschedule, remove on cancel', async ({
  page,
  browser,
}) => {
  // Provider (on `page`) books and shares; the client is a second, separate
  // browser context — its first visit is the import link, so it adopts
  // client mode and gets the client home (the provider page stays provider).
  const { link: firstLink, dateKey } = await bookAndReachShare(page);
  const clientContext = await browser.newContext();
  const client = await clientContext.newPage();

  // F1/AE4-lite: "Add to calendar" leads; the tap downloads the .ics and
  // saves the appointment.
  await client.goto(firstLink);
  await expect(
    client.getByRole('heading', { name: 'New appointment' }),
  ).toBeVisible();
  const added = await clickAndCaptureIcs(
    client,
    client.getByRole('button', { name: 'Add to calendar' }),
  );
  expect(added.fileName).toBe(`when-again-appointment-${dateKey}.ics`);
  const uid = uidLine(added.lines);
  expect(uid).toMatch(/^UID:.+@when-again$/);
  expect(added.lines).toContain('SEQUENCE:0');
  await expect(client.getByRole('heading', { name: 'Added' })).toBeVisible();

  // Saved: the client home shows the visit, and its next-visit card carries
  // its own "Add to calendar" (scoped to the card — the import screen bears
  // the same label on another surface).
  await client.getByRole('button', { name: 'Done' }).click();
  const card = client.getByTestId('next-visit-card');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Haircut');
  const fromCard = await clickAndCaptureIcs(
    client,
    card.getByRole('button', { name: 'Add to calendar' }),
  );
  expect(fromCard.fileName).toBe(`when-again-appointment-${dateKey}.ics`);

  // F2/AE2 (app side): reschedule → the action reads "Update your calendar";
  // the file keeps the UID and bumps SEQUENCE; the card shows the new time.
  const changedLink = await rescheduleAndReachShare(page, dateKey, 1);
  const newTime = decodeWire(changedLink).t.slice(11, 16);
  await client.goto(changedLink);
  await expect(
    client.getByRole('heading', { name: 'Updated appointment' }),
  ).toBeVisible();
  const updated = await clickAndCaptureIcs(
    client,
    client.getByRole('button', { name: 'Update your calendar' }),
  );
  expect(updated.fileName).toBe(`when-again-appointment-${dateKey}.ics`);
  expect(uidLine(updated.lines)).toBe(uid);
  expect(updated.lines).toContain('SEQUENCE:1');
  await expect(client.getByRole('heading', { name: 'Updated' })).toBeVisible();
  await expect(client.locator('dl')).toContainText(`· ${newTime}`);
  // Back home between links: each import opens as a fresh, full page load
  // (same-document hash-only re-navigation is exercised by handoff.spec.ts).
  await client.getByRole('button', { name: 'Done' }).click();
  await expect(client.getByTestId('next-visit-card')).toBeVisible();

  // A SECOND reschedule keeps counting: same UID, SEQUENCE:2. Regression
  // guard — the form's edit path used to drop the stored revision, so every
  // edit wrote revision 1 and repeat reschedules never advanced (or even
  // regressed after a cancel), making clients refuse genuinely newer links.
  const secondLink = await rescheduleAndReachShare(page, dateKey, 2);
  const secondTime = decodeWire(secondLink).t.slice(11, 16);
  await client.goto(secondLink);
  await expect(
    client.getByRole('heading', { name: 'Updated appointment' }),
  ).toBeVisible();
  const updatedAgain = await clickAndCaptureIcs(
    client,
    client.getByRole('button', { name: 'Update your calendar' }),
  );
  expect(updatedAgain.fileName).toBe(`when-again-appointment-${dateKey}.ics`);
  expect(uidLine(updatedAgain.lines)).toBe(uid);
  expect(updatedAgain.lines).toContain('SEQUENCE:2');
  await expect(client.getByRole('heading', { name: 'Updated' })).toBeVisible();
  await expect(client.locator('dl')).toContainText(`· ${secondTime}`);
  await client.getByRole('button', { name: 'Done' }).click();
  await expect(client.getByTestId('next-visit-card')).toBeVisible();

  // F3: cancel → "Remove from calendar"; the file voids the event.
  await page.goto(`${BASE}?date=${dateKey}`);
  await page.getByTestId('appt-block').first().click();
  await page.getByRole('button', { name: 'Cancel appointment' }).click();
  await expect(
    page.getByRole('heading', { name: 'Appointment cancelled' }),
  ).toBeVisible();
  const cancelledLink = await shareLinkAtRevision(page, 3);
  await client.goto(cancelledLink);
  await expect(
    client.getByRole('heading', { name: 'Appointment cancelled' }),
  ).toBeVisible();
  const removed = await clickAndCaptureIcs(
    client,
    client.getByRole('button', { name: 'Remove from calendar' }),
  );
  expect(uidLine(removed.lines)).toBe(uid);
  expect(removed.lines).toContain('STATUS:CANCELLED');
  await expect(
    client.getByRole('heading', { name: 'Cancelled' }),
  ).toBeVisible();

  await clientContext.close();
});

test('AE1: an out-of-date link is refused and the stored card keeps the newer data', async ({
  page,
  browser,
}) => {
  const { link: firstLink, dateKey } = await bookAndReachShare(page);
  const clientContext = await browser.newContext();
  const client = await clientContext.newPage();

  // Client saves revision 0, then imports the rescheduled revision 1.
  await client.goto(firstLink);
  await client.getByRole('button', { name: 'Add to calendar' }).click();
  await expect(client.getByRole('heading', { name: 'Added' })).toBeVisible();
  await client.getByRole('button', { name: 'Done' }).click();
  await expect(client.getByTestId('next-visit-card')).toBeVisible();
  const changedLink = await rescheduleAndReachShare(page, dateKey, 1);
  const newTime = decodeWire(changedLink).t.slice(11, 16);
  await client.goto(changedLink);
  await client.getByRole('button', { name: 'Update your calendar' }).click();
  await expect(client.getByRole('heading', { name: 'Updated' })).toBeVisible();
  await client.getByRole('button', { name: 'Done' }).click();
  await expect(client.getByTestId('next-visit-card')).toBeVisible();

  // Re-opening the FIRST (older) link — as a fresh page load from home, the
  // way a client returns to an old message — refuses: the stale screen, the
  // STORED (current) appointment on the card, and no calendar action at all.
  await client.goto(firstLink);
  await expect(
    client.getByRole('heading', { name: 'This link is out of date' }),
  ).toBeVisible();
  await expect(client.locator('dl')).toContainText(`· ${newTime}`);
  await expect(client.getByTestId('calendar-action')).toHaveCount(0);

  await clientContext.close();
});
