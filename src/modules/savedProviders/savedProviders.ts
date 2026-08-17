import Dexie, { type EntityTable } from 'dexie';
import { db } from '../db';

// The client's saved record of a provider (CONTEXT.md "Saved provider",
// ADR-0002). Identity is the provider's minted id carried in the handoff
// payload; name/address/phone are attributes overwritten wholesale by each
// import, so a provider rename heals the client's grouping retroactively.
export interface SavedProvider {
  id: string;
  name: string;
  address?: string;
  phone?: string;
}

declare module '../db' {
  interface WhenAgainDB {
    savedProviders: EntityTable<SavedProvider, 'id'>;
  }
}

export function defineSavedProvidersStore(db: Dexie): void {
  // Version 2 of the shared schema sequence adds this table. Dexie carries
  // every version-1 store forward, so the other entity modules keep their
  // v1 lines untouched.
  db.version(2).stores({ savedProviders: 'id' });
}

// Grouping key for payloads that predate the minted id (ADR-0002): derived
// from the normalized provider name so import's auto-upsert works uniformly.
export function syntheticProviderId(name: string): string {
  return `name:${name.trim().replace(/\s+/g, ' ').toLowerCase()}`;
}

export async function getSavedProvider(
  id: string,
): Promise<SavedProvider | undefined> {
  return db.savedProviders.get(id);
}

export async function upsertSavedProvider(
  provider: SavedProvider,
): Promise<void> {
  await db.savedProviders.put(provider);
}

// JS sort, not Dexie .orderBy: IndexedDB collation is binary, wrong for
// Cyrillic (same reason listClients sorts in JS).
export async function listSavedProviders(): Promise<SavedProvider[]> {
  const all = await db.savedProviders.toArray();
  return all.sort((a, b) => a.name.localeCompare(b.name));
}

// Deleting a saved provider removes its received visits too (spec: one
// confirm, both gone). `providerId` is not indexed — a client's dataset is
// dozens of rows — so filter in JS inside one rw transaction (the backup
// pattern: cross-table work goes through the db object).
export async function deleteSavedProviderWithVisits(id: string): Promise<void> {
  await db.transaction('rw', db.savedProviders, db.received, async () => {
    const visitIds = (await db.received.toArray())
      .filter((visit) => visit.providerId === id)
      .map((visit) => visit.id);
    await db.received.bulkDelete(visitIds);
    await db.savedProviders.delete(id);
  });
}
