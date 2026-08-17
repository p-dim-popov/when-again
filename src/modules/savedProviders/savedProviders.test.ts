import { describe, expect, it } from 'vitest';
import { getDataVersion } from '../db';
import { upsertReceived, listReceived } from '../received';
import {
  deleteSavedProviderWithVisits,
  getSavedProvider,
  listSavedProviders,
  syntheticProviderId,
  upsertSavedProvider,
  type SavedProvider,
} from './savedProviders';

const maria: SavedProvider = {
  id: 'prov-1',
  name: 'Студио Мария',
  address: 'ул. Роза 5',
  phone: '+359 88 123 4567',
};

function visit(id: string, providerId: string | undefined, dateTime: string) {
  return {
    id,
    providerName: 'Студио Мария',
    service: 'Подстригване',
    start: { dateTime, timeZone: 'Europe/Sofia' },
    durationMinutes: 30,
    status: 'booked' as const,
    ...(providerId ? { providerId } : {}),
  };
}

describe('savedProviders store', () => {
  it('round-trips a record', async () => {
    await upsertSavedProvider(maria);
    expect(await getSavedProvider('prov-1')).toEqual(maria);
  });

  it('upsert overwrites attributes wholesale (healing)', async () => {
    await upsertSavedProvider(maria);
    await upsertSavedProvider({ id: 'prov-1', name: 'Студио Мария ✂️' });
    const stored = await getSavedProvider('prov-1');
    expect(stored?.name).toBe('Студио Мария ✂️');
    expect(stored?.phone).toBeUndefined(); // absent attribute clears
  });

  it('lists sorted by name with localeCompare (Cyrillic-correct)', async () => {
    await upsertSavedProvider({ id: 'b', name: 'Ясен' });
    await upsertSavedProvider({ id: 'a', name: 'Ася' });
    const names = (await listSavedProviders()).map((p) => p.name);
    expect(names).toEqual(['Ася', 'Ясен']);
  });

  it('bumps the shared schema to version 2 (native 20)', async () => {
    expect(await getDataVersion()).toBe(20);
  });
});

describe('syntheticProviderId', () => {
  it('normalizes: trim, collapse whitespace, lowercase', () => {
    expect(syntheticProviderId('  Студио   МАРИЯ ')).toBe('name:студио мария');
    expect(syntheticProviderId('Studio M')).toBe('name:studio m');
  });
});

describe('deleteSavedProviderWithVisits', () => {
  it('removes the record and only its visits, atomically', async () => {
    await upsertSavedProvider(maria);
    await upsertSavedProvider({ id: 'prov-2', name: 'Друг салон' });
    await upsertReceived(visit('v1', 'prov-1', '2026-09-01T10:00'));
    await upsertReceived(visit('v2', 'prov-1', '2026-09-08T10:00'));
    await upsertReceived(visit('v3', 'prov-2', '2026-09-02T12:00'));
    await upsertReceived(visit('v4', undefined, '2026-09-03T12:00')); // legacy, no providerId

    await deleteSavedProviderWithVisits('prov-1');

    expect(await getSavedProvider('prov-1')).toBeUndefined();
    expect(await getSavedProvider('prov-2')).toBeDefined();
    const remaining = (await listReceived()).map((v) => v.id).sort();
    expect(remaining).toEqual(['v3', 'v4']);
  });
});
