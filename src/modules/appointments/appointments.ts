import Dexie, { type EntityTable } from 'dexie';
import { db } from '../db';
import { type WallClock } from '../time';

export type AppointmentStatus = 'booked' | 'done' | 'cancelled';

export interface Appointment {
  id: string;
  clientId: string;
  start: WallClock;
  durationMinutes: number;
  service: string;
  price?: number;
  status: AppointmentStatus;
  /**
   * Monotonic per-appointment revision: seeded 0 on create, bumped on every
   * provider mutation (iCalendar SEQUENCE derives from it). Absent on rows
   * created before this field. Not indexed.
   */
  revision?: number;
}

declare module '../db' {
  interface WhenAgainDB {
    appointments: EntityTable<Appointment, 'id'>;
  }
}

export function defineAppointmentsStore(db: Dexie): void {
  db.version(1).stores({ appointments: 'id, clientId, start.dateTime' });
}

export async function addAppointment(
  data: Omit<Appointment, 'id' | 'revision'>,
): Promise<Appointment> {
  const appointment: Appointment = {
    id: crypto.randomUUID(),
    ...data,
    revision: 0,
  };
  await db.appointments.add(appointment);
  return appointment;
}

export async function updateAppointment(
  appointment: Appointment,
): Promise<void> {
  // Every provider mutation bumps the revision unconditionally (a no-op edit
  // bumping is accepted). The bump derives from the STORED row inside the
  // transaction, not the caller's copy — a stale in-memory object (unresolved
  // live query, second tab) must never regress the monotonic revision that
  // drives .ics SEQUENCE and the client-side stale guard. Legacy rows without
  // one count as revision 0.
  await db.transaction('rw', db.appointments, async () => {
    const current = await db.appointments.get(appointment.id);
    await db.appointments.put({
      ...appointment,
      revision: (current?.revision ?? appointment.revision ?? 0) + 1,
    });
  });
}

export async function getAppointment(
  id: string,
): Promise<Appointment | undefined> {
  return db.appointments.get(id);
}

export async function listAppointmentsOnDate(
  date: string,
): Promise<Appointment[]> {
  return db.appointments
    .where('start.dateTime')
    .between(`${date}T00:00`, `${date}T23:59`, true, true)
    .sortBy('start.dateTime');
}

export async function listAppointmentsByClient(
  clientId: string,
): Promise<Appointment[]> {
  return db.appointments
    .where('clientId')
    .equals(clientId)
    .sortBy('start.dateTime');
}

export async function listAllAppointments(): Promise<Appointment[]> {
  return db.appointments.toArray();
}

export async function replaceAllAppointments(
  items: Appointment[],
): Promise<void> {
  await db.transaction('rw', db.appointments, async () => {
    await db.appointments.clear();
    await db.appointments.bulkPut(items);
  });
}
