import Dexie, { type EntityTable } from 'dexie';
import { db } from '../db';
import { type WallClock } from '../time';

// An appointment the CLIENT received from a salon (via the handoff QR/link),
// stored on the client device. Distinct from the provider's own
// `appointments` store: it carries the provider's name/address and has no
// local clientId. Keyed by the provider's appointment id so a reshare
// overwrites in place. #7's "salons" home builds on this store.
export interface ReceivedAppointment {
  id: string;
  providerName: string;
  address?: string;
  service: string;
  start: WallClock;
  durationMinutes: number;
  status: 'booked' | 'cancelled';
}

declare module '../db' {
  interface WhenAgainDB {
    received: EntityTable<ReceivedAppointment, 'id'>;
  }
}

export function defineReceivedStore(db: Dexie): void {
  db.version(1).stores({ received: 'id' });
}

export async function getReceived(
  id: string,
): Promise<ReceivedAppointment | undefined> {
  return db.received.get(id);
}

export async function upsertReceived(appt: ReceivedAppointment): Promise<void> {
  await db.received.put(appt);
}

export async function listReceived(): Promise<ReceivedAppointment[]> {
  return db.received.toArray();
}
