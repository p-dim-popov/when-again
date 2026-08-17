import { describe, expect, it } from 'vitest';
import {
  adoptClientModeIfUnset,
  DEFAULT_SETTINGS,
  ensureProviderId,
  getSettings,
  replaceSettings,
  updateSettings,
} from './settings';

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

  it('does not share the DEFAULT_SETTINGS.services array reference across calls', async () => {
    const first = await getSettings();
    first.services.push({ name: 'Haircut', durationMinutes: 45 });
    const second = await getSettings();
    expect(second.services).toEqual([]);
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

describe('theme setting', () => {
  it('defaults to null (auto)', async () => {
    expect((await getSettings()).theme).toBeNull();
  });

  it('persists an explicit theme', async () => {
    await updateSettings({ theme: 'dark' });
    expect((await getSettings()).theme).toBe('dark');
  });
});

describe('ensureProviderId', () => {
  it('mints a uuid once and returns the same id forever after', async () => {
    const first = await ensureProviderId();
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    const second = await ensureProviderId();
    expect(second).toBe(first);
    expect((await getSettings()).providerId).toBe(first);
  });

  it('defaults to null on a fresh profile', async () => {
    expect((await getSettings()).providerId).toBeNull();
  });
});

describe('adoptClientModeIfUnset', () => {
  it('sets client mode when mode is null', async () => {
    await adoptClientModeIfUnset();
    expect((await getSettings()).mode).toBe('client');
  });

  it('never flips an existing mode', async () => {
    await updateSettings({ mode: 'provider' });
    await adoptClientModeIfUnset();
    expect((await getSettings()).mode).toBe('provider');
  });
});
