import { describe, expect, it } from 'vitest';
import {
  addAppointment,
  getAppointment,
  listAllAppointments,
  listAppointmentsByClient,
  listAppointmentsOnDate,
  replaceAllAppointments,
  updateAppointment,
  type Appointment,
} from './appointments';

const base = {
  clientId: 'c1',
  durationMinutes: 45,
  service: 'Haircut',
  status: 'booked' as const,
};

const at = (dateTime: string) => ({ dateTime, timeZone: 'Europe/Sofia' });

describe('appointments', () => {
  it('adds with a generated id and reads back', async () => {
    const a = await addAppointment({ ...base, start: at('2026-08-21T14:00') });
    expect(a.id).toMatch(/[0-9a-f-]{36}/);
    expect(await getAppointment(a.id)).toEqual(a);
  });

  it('updates in place by id', async () => {
    const a = await addAppointment({ ...base, start: at('2026-08-21T14:00') });
    await updateAppointment({ ...a, status: 'cancelled' });
    expect((await getAppointment(a.id))?.status).toBe('cancelled');
  });

  it('lists a day sorted by start time, excluding other days', async () => {
    await addAppointment({ ...base, start: at('2026-08-21T15:00') });
    await addAppointment({ ...base, start: at('2026-08-21T09:30') });
    await addAppointment({ ...base, start: at('2026-08-22T10:00') });
    const day = await listAppointmentsOnDate('2026-08-21');
    expect(day.map((a) => a.start.dateTime)).toEqual([
      '2026-08-21T09:30',
      '2026-08-21T15:00',
    ]);
  });

  it('lists by client sorted by start time', async () => {
    await addAppointment({ ...base, start: at('2026-09-01T10:00') });
    await addAppointment({
      ...base,
      clientId: 'c2',
      start: at('2026-09-01T11:00'),
    });
    await addAppointment({ ...base, start: at('2026-08-01T10:00') });
    const forC1 = await listAppointmentsByClient('c1');
    expect(forC1.map((a) => a.start.dateTime)).toEqual([
      '2026-08-01T10:00',
      '2026-09-01T10:00',
    ]);
  });

  it('replaceAllAppointments wipes and restores', async () => {
    await addAppointment({ ...base, start: at('2026-08-21T14:00') });
    const restored: Appointment[] = [
      { ...base, id: 'x1', start: at('2027-01-01T08:00') },
    ];
    await replaceAllAppointments(restored);
    expect(await listAllAppointments()).toEqual(restored);
  });
});
