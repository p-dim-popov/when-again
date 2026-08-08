import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { destroyDb } from '../db';
import {
  DEFAULT_SETTINGS,
  getSettings,
  replaceSettings,
  updateSettings,
} from './settings';

afterEach(async () => {
  await destroyDb();
});

describe('settings', () => {
  it('returns defaults when nothing is stored', async () => {
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('updates a subset and persists it', async () => {
    const updated = await updateSettings({
      providerName: 'Salon Maria',
      language: 'bg',
    });
    expect(updated.providerName).toBe('Salon Maria');
    expect(updated.language).toBe('bg');
    expect(await getSettings()).toEqual(updated);
  });

  it('merges patches without dropping earlier fields', async () => {
    await updateSettings({ providerName: 'Salon Maria' });
    await updateSettings({ mode: 'provider' });
    const s = await getSettings();
    expect(s.providerName).toBe('Salon Maria');
    expect(s.mode).toBe('provider');
  });

  it('replaceSettings overwrites everything', async () => {
    await updateSettings({ providerName: 'Old' });
    const next = {
      ...DEFAULT_SETTINGS,
      providerName: 'New',
      services: [{ name: 'Haircut', durationMinutes: 45 }],
    };
    await replaceSettings(next);
    expect(await getSettings()).toEqual(next);
  });
});
