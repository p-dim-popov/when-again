import { describe, expect, it } from 'vitest';
import { db, getDataVersion, requestPersistentStorage } from './db';

describe('db', () => {
  it('exposes the four registered stores', () => {
    expect(db.tables.map((t) => t.name).sort()).toEqual(
      ['appointments', 'clients', 'received', 'settings'].sort(),
    );
  });

  it('round-trips a record through a registered store', async () => {
    await db.clients.put({ id: 'c1', name: 'Maria' });
    expect(await db.clients.get('c1')).toEqual({ id: 'c1', name: 'Maria' });
  });
});

describe('requestPersistentStorage', () => {
  it('returns false when the API is unavailable', async () => {
    expect(await requestPersistentStorage()).toBe(false);
  });
});

describe('getDataVersion', () => {
  it('reports the native IndexedDB version (declared Dexie version × 10)', async () => {
    // src/test/setup-db.ts declares every store at Dexie version(1),
    // which Dexie opens as native IndexedDB version 10.
    expect(await getDataVersion()).toBe(10);
  });
});
