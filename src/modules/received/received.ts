import { getDb, STORE_RECEIVED } from '../db';
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

export async function getReceived(
  id: string,
): Promise<ReceivedAppointment | undefined> {
  const db = await getDb();
  return (await db.get(STORE_RECEIVED, id)) as ReceivedAppointment | undefined;
}

export async function upsertReceived(appt: ReceivedAppointment): Promise<void> {
  const db = await getDb();
  await db.put(STORE_RECEIVED, appt);
}

export async function listReceived(): Promise<ReceivedAppointment[]> {
  const db = await getDb();
  return (await db.getAll(STORE_RECEIVED)) as ReceivedAppointment[];
}
