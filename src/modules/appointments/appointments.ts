import {
  getDb,
  INDEX_APPOINTMENTS_BY_CLIENT,
  INDEX_APPOINTMENTS_BY_DATETIME,
  STORE_APPOINTMENTS,
} from '../db';
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

export async function addAppointment(
  data: Omit<Appointment, 'id'>,
): Promise<Appointment> {
  const appointment: Appointment = { id: crypto.randomUUID(), ...data };
  const db = await getDb();
  await db.add(STORE_APPOINTMENTS, appointment);
  return appointment;
}

export async function updateAppointment(
  appointment: Appointment,
): Promise<void> {
  const db = await getDb();
  await db.put(STORE_APPOINTMENTS, appointment);
}

export async function getAppointment(
  id: string,
): Promise<Appointment | undefined> {
  const db = await getDb();
  return (await db.get(STORE_APPOINTMENTS, id)) as Appointment | undefined;
}

const byStart = (a: Appointment, b: Appointment) =>
  a.start.dateTime < b.start.dateTime
    ? -1
    : a.start.dateTime > b.start.dateTime
      ? 1
      : 0;

export async function listAppointmentsOnDate(
  date: string,
): Promise<Appointment[]> {
  const db = await getDb();
  const range = IDBKeyRange.bound(`${date}T00:00`, `${date}T23:59`);
  const items = (await db.getAllFromIndex(
    STORE_APPOINTMENTS,
    INDEX_APPOINTMENTS_BY_DATETIME,
    range,
  )) as Appointment[];
  return items.sort(byStart);
}

export async function listAppointmentsByClient(
  clientId: string,
): Promise<Appointment[]> {
  const db = await getDb();
  const items = (await db.getAllFromIndex(
    STORE_APPOINTMENTS,
    INDEX_APPOINTMENTS_BY_CLIENT,
    clientId,
  )) as Appointment[];
  return items.sort(byStart);
}

export async function listAllAppointments(): Promise<Appointment[]> {
  const db = await getDb();
  return (await db.getAll(STORE_APPOINTMENTS)) as Appointment[];
}

export async function replaceAllAppointments(
  items: Appointment[],
): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(STORE_APPOINTMENTS, 'readwrite');
  await tx.store.clear();
  for (const item of items) await tx.store.put(item);
  await tx.done;
}
