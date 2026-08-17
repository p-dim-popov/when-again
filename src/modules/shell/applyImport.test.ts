import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BackupFile } from '../backup';
import { destroyDb } from '../db';
import { getSettings } from '../settings';
import { applyImportedBackup } from './applyImport';

afterEach(async () => {
  await destroyDb();
});

function fakeRoot(): { dataset: DOMStringMap } {
  return { dataset: {} as DOMStringMap };
}

function backupWith(theme: BackupFile['settings']['theme']): BackupFile {
  return {
    app: 'when-again',
    version: 1,
    exportedAt: '2026-08-08T10:00:00.000Z',
    settings: {
      providerName: 'Salon Maria',
      providerId: null,
      services: [],
      language: 'bg',
      mode: 'provider',
      theme,
      lastBackupAt: '2026-08-08T10:00:00.000Z',
    },
    clients: [],
    appointments: [],
  };
}

describe('applyImportedBackup', () => {
  it('replaces settings, applies the theme attribute, and reloads', async () => {
    const reload = vi.fn();
    const root = fakeRoot();
    await applyImportedBackup(backupWith('dark'), { reload }, root);

    expect((await getSettings()).providerName).toBe('Salon Maria');
    expect((await getSettings()).theme).toBe('dark');
    expect(root.dataset.theme).toBe('dark');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('removes data-theme for a backup with Auto theme', async () => {
    const reload = vi.fn();
    const root = fakeRoot();
    root.dataset.theme = 'light';
    await applyImportedBackup(backupWith(null), { reload }, root);

    expect(root.dataset.theme).toBeUndefined();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
