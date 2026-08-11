import Dexie, { type EntityTable } from 'dexie';
import { listAppointmentsByClient, type Appointment } from '../appointments';
import { db } from '../db';
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

declare module '../db' {
  interface WhenAgainDB {
    clients: EntityTable<Client, 'id'>;
  }
}

export function defineClientsStore(db: Dexie): void {
  db.version(1).stores({ clients: 'id' });
}

export async function addClient(data: Omit<Client, 'id'>): Promise<Client> {
  const client: Client = { id: crypto.randomUUID(), ...data };
  await db.clients.add(client);
  return client;
}

export async function updateClient(client: Client): Promise<void> {
  await db.clients.put(client);
}

export async function getClient(id: string): Promise<Client | undefined> {
  return db.clients.get(id);
}

export async function listClients(): Promise<Client[]> {
  const clients = await db.clients.toArray();
  return clients.sort((a, b) => a.name.localeCompare(b.name));
}

export async function replaceAllClients(clients: Client[]): Promise<void> {
  await db.transaction('rw', db.clients, async () => {
    await db.clients.clear();
    await db.clients.bulkPut(clients);
  });
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
