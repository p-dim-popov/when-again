import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { destroyDb } from '../db';
import { getSettings } from '../settings';
import { applyLanguageChoice } from './switchLanguage';

afterEach(async () => {
  await destroyDb();
});

describe('applyLanguageChoice', () => {
  it('persists the chosen language and reloads', async () => {
    const reload = vi.fn();
    await applyLanguageChoice('bg', { reload });
    expect((await getSettings()).language).toBe('bg');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('persists null for auto and reloads', async () => {
    const reload = vi.fn();
    await applyLanguageChoice(null, { reload });
    expect((await getSettings()).language).toBeNull();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
