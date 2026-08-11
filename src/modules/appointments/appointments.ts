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
  data: Omit<Appointment, 'id'>,
): Promise<Appointment> {
  const appointment: Appointment = { id: crypto.randomUUID(), ...data };
  await db.appointments.add(appointment);
  return appointment;
}

export async function updateAppointment(
  appointment: Appointment,
): Promise<void> {
  await db.appointments.put(appointment);
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
