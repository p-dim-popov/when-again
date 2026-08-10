import { describe, expect, it } from 'vitest';
import {
  getReceived,
  listReceived,
  upsertReceived,
  type ReceivedAppointment,
} from './received';

const sample: ReceivedAppointment = {
  id: 'appt-1',
  providerName: 'Салон Арома',
  address: 'ул. Витоша 1',
  service: 'Подстригване',
  start: { dateTime: '2026-08-15T15:00', timeZone: 'Europe/Sofia' },
  durationMinutes: 45,
  status: 'booked',
};

describe('received store', () => {
  it('returns undefined for an unknown id', async () => {
    expect(await getReceived('missing')).toBeUndefined();
  });

  it('upserts and reads back by id', async () => {
    await upsertReceived(sample);
    expect(await getReceived('appt-1')).toEqual(sample);
  });

  it('overwrites in place on a second upsert with the same id', async () => {
    await upsertReceived(sample);
    await upsertReceived({ ...sample, status: 'cancelled' });
    expect((await getReceived('appt-1'))?.status).toBe('cancelled');
    expect(await listReceived()).toHaveLength(1);
  });

  it('lists all received appointments', async () => {
    await upsertReceived(sample);
    await upsertReceived({ ...sample, id: 'appt-2' });
    expect((await listReceived()).map((a) => a.id).sort()).toEqual([
      'appt-1',
      'appt-2',
    ]);
  });
});
