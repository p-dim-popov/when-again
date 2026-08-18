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

  it('seeds revision 0 on create', async () => {
    const a = await addAppointment({ ...base, start: at('2026-08-21T14:00') });
    expect(a.revision).toBe(0);
    expect((await getAppointment(a.id))?.revision).toBe(0);
  });

  it('bumps revision on every update, including a status flip', async () => {
    const a = await addAppointment({ ...base, start: at('2026-08-21T14:00') });
    await updateAppointment({ ...a, service: 'Trim' });
    const after1 = await getAppointment(a.id);
    expect(after1?.revision).toBe(1);
    await updateAppointment({ ...after1!, status: 'cancelled' });
    expect((await getAppointment(a.id))?.revision).toBe(2);
  });

  it('treats a missing revision as 0 when updating a legacy record', async () => {
    const legacy: Appointment = {
      ...base,
      id: 'legacy-1',
      start: at('2026-08-21T14:00'),
    };
    await replaceAllAppointments([legacy]);
    await updateAppointment({ ...legacy, service: 'Trim' });
    expect((await getAppointment('legacy-1'))?.revision).toBe(1);
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

  it('replaceAllAppointments preserves stored revisions untouched', async () => {
    const restored: Appointment[] = [
      { ...base, id: 'x1', start: at('2027-01-01T08:00'), revision: 5 },
    ];
    await replaceAllAppointments(restored);
    expect((await getAppointment('x1'))?.revision).toBe(5);
  });
});
