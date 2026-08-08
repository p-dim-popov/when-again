import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DB_NAME,
  destroyDb,
  getDb,
  INDEX_APPOINTMENTS_BY_CLIENT,
  INDEX_APPOINTMENTS_BY_DATETIME,
  requestPersistentStorage,
  STORE_APPOINTMENTS,
  STORE_CLIENTS,
  STORE_SETTINGS,
} from './db';

afterEach(async () => {
  await destroyDb();
});

describe('getDb', () => {
  it('creates the three object stores', async () => {
    const db = await getDb();
    expect(db.name).toBe(DB_NAME);
    expect([...db.objectStoreNames].sort()).toEqual(
      [STORE_APPOINTMENTS, STORE_CLIENTS, STORE_SETTINGS].sort(),
    );
  });

  it('creates the appointment indexes', async () => {
    const db = await getDb();
    const tx = db.transaction(STORE_APPOINTMENTS);
    const names = [...tx.store.indexNames];
    expect(names).toContain(INDEX_APPOINTMENTS_BY_CLIENT);
    expect(names).toContain(INDEX_APPOINTMENTS_BY_DATETIME);
  });

  it('memoizes the connection', async () => {
    expect(await getDb()).toBe(await getDb());
  });

  it('persists data across close and reopen', async () => {
    const db = await getDb();
    await db.put(STORE_CLIENTS, { id: 'c1', name: 'Maria' });
    db.close();
    const reopened = await getDb();
    expect(await reopened.get(STORE_CLIENTS, 'c1')).toEqual({
      id: 'c1',
      name: 'Maria',
    });
  });

  it('concurrent getDb calls after close resolve to same connection', async () => {
    const db = await getDb();
    await db.put(STORE_CLIENTS, { id: 'c1', name: 'Maria' });
    db.close();
    // Fire two concurrent getDb() calls while connection is stale
    const [reopened1, reopened2] = await Promise.all([getDb(), getDb()]);
    // Both should resolve to the same database instance
    expect(reopened1).toBe(reopened2);
    // And both should be able to read the persisted data
    const data1 = await reopened1.get(STORE_CLIENTS, 'c1');
    const data2 = await reopened2.get(STORE_CLIENTS, 'c1');
    expect(data1).toEqual({ id: 'c1', name: 'Maria' });
    expect(data2).toEqual({ id: 'c1', name: 'Maria' });
  });
});

describe('requestPersistentStorage', () => {
  it('returns false when the API is unavailable', async () => {
    expect(await requestPersistentStorage()).toBe(false);
  });
});
