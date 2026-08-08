import { listAppointmentsByClient, type Appointment } from '../appointments';
import { getDb, STORE_CLIENTS } from '../db';
import {
  compareWallClock,
  isBefore,
  wallClockNow,
  type WallClock,
} from '../time';

export interface Client {
  id: string;
  name: string;
  phone?: string;
  notes?: string;
}

export async function addClient(data: Omit<Client, 'id'>): Promise<Client> {
  const client: Client = { id: crypto.randomUUID(), ...data };
  const db = await getDb();
  await db.add(STORE_CLIENTS, client);
  return client;
}

export async function updateClient(client: Client): Promise<void> {
  const db = await getDb();
  await db.put(STORE_CLIENTS, client);
}

export async function getClient(id: string): Promise<Client | undefined> {
  const db = await getDb();
  return (await db.get(STORE_CLIENTS, id)) as Client | undefined;
}

export async function listClients(): Promise<Client[]> {
  const db = await getDb();
  const clients = (await db.getAll(STORE_CLIENTS)) as Client[];
  return clients.sort((a, b) => a.name.localeCompare(b.name));
}

export async function replaceAllClients(clients: Client[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(STORE_CLIENTS, 'readwrite');
  await tx.store.clear();
  for (const client of clients) await tx.store.put(client);
  await tx.done;
}

export async function getVisitHistory(
  clientId: string,
  now: WallClock = wallClockNow(),
): Promise<Appointment[]> {
  const all = await listAppointmentsByClient(clientId);
  return all
    .filter((a) => a.status !== 'cancelled' && isBefore(a.start, now))
    .sort((a, b) => compareWallClock(b.start, a.start));
}
