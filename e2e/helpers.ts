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
