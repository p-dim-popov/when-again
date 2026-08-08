import { openDB, type IDBPDatabase } from 'idb';

export const DB_NAME = 'when-again';
export const STORE_CLIENTS = 'clients';
export const STORE_APPOINTMENTS = 'appointments';
export const STORE_SETTINGS = 'settings';
export const INDEX_APPOINTMENTS_BY_CLIENT = 'byClientId';
export const INDEX_APPOINTMENTS_BY_DATETIME = 'byDateTime';

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getDb(): Promise<IDBPDatabase> {
  if (dbPromise) {
    return dbPromise.then((db) => {
      // Verify database is still open by attempting a transaction
      try {
        db.transaction([STORE_CLIENTS], 'readonly');
        return db;
      } catch {
        // Database closed, reset memoization
        dbPromise = null;
        return getDb();
      }
    });
  }

  dbPromise = openDB(DB_NAME, 1, {
    upgrade(db) {
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
