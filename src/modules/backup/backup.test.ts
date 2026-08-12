import { describe, expect, it, vi } from 'vitest';
import { addAppointment, listAllAppointments } from '../appointments';
import { addClient, listClients } from '../clients';
import { destroyDb } from '../db';
import { getSettings, updateSettings } from '../settings';
import {
  exportBackup,
  importBackup,
  isBackupStale,
  parseBackup,
} from './backup';

// Wraps the real implementation so every test but the one below behaves
// unchanged; that one test overrides it for a single call.
vi.mock('../appointments', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../appointments')>();
  return { ...actual, listAllAppointments: vi.fn(actual.listAllAppointments) };
});

const at = (dateTime: string) => ({ dateTime, timeZone: 'Europe/Sofia' });

async function seed() {
  await updateSettings({ providerName: 'Salon Maria', language: 'bg' });
  const client = await addClient({ name: 'Anna', phone: '+359888123456' });
  await addAppointment({
    clientId: client.id,
    start: at('2026-08-21T14:00'),
    durationMinutes: 45,
    service: 'Haircut',
    price: 30,
    status: 'booked',
  });
}

describe('exportBackup', () => {
  it('captures settings, clients, and appointments, and stamps lastBackupAt', async () => {
    await seed();
    const now = new Date('2026-08-08T10:00:00.000Z');
    const backup = await exportBackup(now);
    expect(backup.app).toBe('when-again');
    expect(backup.version).toBe(1);
    expect(backup.exportedAt).toBe('2026-08-08T10:00:00.000Z');
    expect(backup.clients).toHaveLength(1);
    expect(backup.appointments).toHaveLength(1);
    expect(backup.settings.providerName).toBe('Salon Maria');
    expect((await getSettings()).lastBackupAt).toBe('2026-08-08T10:00:00.000Z');
  });

  it('does not stamp lastBackupAt when a read fails', async () => {
    await seed();
    const failure = new Error('indexeddb read failed');
    vi.mocked(listAllAppointments).mockRejectedValueOnce(failure);

    await expect(
      exportBackup(new Date('2026-08-08T10:00:00.000Z')),
    ).rejects.toThrow(failure);
    expect((await getSettings()).lastBackupAt).toBeNull();
  });
});

describe('export → wipe → import round-trip', () => {
  it('loses nothing', async () => {
    await seed();
    const backup = await exportBackup(new Date('2026-08-08T10:00:00.000Z'));
    const json = JSON.stringify(backup);

    await destroyDb(); // the wipe

    await importBackup(JSON.parse(json));
    expect(await getSettings()).toEqual(backup.settings);
    expect(await listClients()).toEqual(backup.clients);
    expect(await listAllAppointments()).toEqual(backup.appointments);
  });
});

describe('parseBackup', () => {
  it('rejects garbage', () => {
    expect(() => parseBackup(null)).toThrow('invalid backup file');
    expect(() => parseBackup({})).toThrow('invalid backup file');
    expect(() => parseBackup({ app: 'other', version: 1 })).toThrow(
      'invalid backup file',
    );
    expect(() => parseBackup({ app: 'when-again', version: 99 })).toThrow(
      'invalid backup file',
    );
  });

  it('rejects an array for settings', () => {
    expect(() =>
      parseBackup({
        app: 'when-again',
        version: 1,
        exportedAt: 's',
        settings: [],
        clients: [],
        appointments: [],
      }),
    ).toThrow('invalid backup file');
  });
});

describe('isBackupStale', () => {
  const now = new Date('2026-08-08T00:00:00.000Z');
  it('is stale when never backed up', () => {
    expect(isBackupStale(null, now)).toBe(true);
  });
  it('is fresh within 31 days', () => {
    expect(isBackupStale('2026-07-20T00:00:00.000Z', now)).toBe(false);
  });
  it('is stale after 31 days', () => {
    expect(isBackupStale('2026-06-01T00:00:00.000Z', now)).toBe(true);
  });
  it('fails safe to stale when lastBackupAt is unparseable', () => {
    expect(isBackupStale('not-a-date', now)).toBe(true);
  });
});
