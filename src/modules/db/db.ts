import Dexie from 'dexie';

// Zero-knowledge leaf. Each entity module contributes its typed table by
// augmenting this interface via `declare module '../db'`, and its schema via a
// `defineXStore(db)` visitor the composition root (src/app/main.tsx, and the
// Vitest setup) calls before the database is first used.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface WhenAgainDB extends Dexie {}

export const db = new Dexie('when-again') as WhenAgainDB;

/** Close and delete the database. Test helper — never called by app code. */
export async function destroyDb(): Promise<void> {
  // `disableAutoOpen: false` (Dexie's default is `true`) so the next DB
  // operation transparently reopens using the version specs already
  // declared on this instance, instead of throwing `DatabaseClosedError`.
  await db.delete({ disableAutoOpen: false });
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
