import { openDB, type IDBPDatabase } from 'idb';

export const DB_NAME = 'when-again';
export const STORE_CLIENTS = 'clients';
export const STORE_APPOINTMENTS = 'appointments';
export const STORE_SETTINGS = 'settings';
export const STORE_RECEIVED = 'received';
export const INDEX_APPOINTMENTS_BY_CLIENT = 'byClientId';
export const INDEX_APPOINTMENTS_BY_DATETIME = 'byDateTime';

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getDb(): Promise<IDBPDatabase> {
  if (dbPromise) {
    const currentPromise = dbPromise;
    return currentPromise.then((db) => {
      // Get store-agnostic liveness probe: use first available store
      const firstStoreName = db.objectStoreNames[0];
      if (!firstStoreName) {
        // No stores, database is likely closed
        if (dbPromise === currentPromise) {
          dbPromise = null;
        }
        return getDb();
      }

      // Verify database is still open by attempting a transaction
      try {
        db.transaction([firstStoreName], 'readonly');
        return db;
      } catch {
        // Database closed; only reset if this is still the current promise
        // This guard prevents race condition when multiple concurrent getDb() calls fail
        if (dbPromise === currentPromise) {
          dbPromise = null;
          return getDb();
        }
        // Another caller already reset and recovered; await the recovered promise
        return currentPromise.then(() => getDb());
      }
    });
  }

  dbPromise = openDB(DB_NAME, 2, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore(STORE_CLIENTS, { keyPath: 'id' });
        const appointments = db.createObjectStore(STORE_APPOINTMENTS, {
          keyPath: 'id',
        });
        appointments.createIndex(INDEX_APPOINTMENTS_BY_CLIENT, 'clientId');
        appointments.createIndex(
          INDEX_APPOINTMENTS_BY_DATETIME,
          'start.dateTime',
        );
        db.createObjectStore(STORE_SETTINGS, { keyPath: 'id' });
      }
      if (oldVersion < 2) {
        db.createObjectStore(STORE_RECEIVED, { keyPath: 'id' });
      }
    },
    terminated() {
      dbPromise = null;
    },
  }).then((db) => {
    db.addEventListener('close', () => {
      dbPromise = null;
    });
    return db;
  });
  return dbPromise;
}

export function closeDb(): void {
  void dbPromise?.then((db) => db.close());
  dbPromise = null;
}

/** Close and delete the database. Test helper — never called by app code. */
export async function destroyDb(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
    dbPromise = null;
  }
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error('deleteDatabase failed'));
    req.onblocked = () => resolve();
  });
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist)
    return false;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
