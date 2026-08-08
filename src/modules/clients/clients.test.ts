import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { addAppointment, replaceAllAppointments } from '../appointments';
import { destroyDb } from '../db';
import {
  addClient,
  getClient,
  getVisitHistory,
  listClients,
  replaceAllClients,
  updateClient,
} from './clients';

afterEach(async () => {
  await destroyDb();
});

describe('clients', () => {
  it('adds with a generated id and reads back', async () => {
    const c = await addClient({ name: 'Maria', phone: '+359888123456' });
    expect(c.id).toMatch(/[0-9a-f-]{36}/);
    expect(await getClient(c.id)).toEqual(c);
  });

  it('updates in place', async () => {
    const c = await addClient({ name: 'Maria' });
    await updateClient({ ...c, notes: 'prefers mornings' });
    expect((await getClient(c.id))?.notes).toBe('prefers mornings');
  });

  it('lists sorted by name', async () => {
    await addClient({ name: 'Zara' });
    await addClient({ name: 'Anna' });
    expect((await listClients()).map((c) => c.name)).toEqual(['Anna', 'Zara']);
  });

  it('replaceAllClients wipes and restores', async () => {
    await addClient({ name: 'Old' });
    await replaceAllClients([{ id: 'x1', name: 'Restored' }]);
    expect((await listClients()).map((c) => c.name)).toEqual(['Restored']);
  });
});

describe('getVisitHistory', () => {
  const at = (dateTime: string) => ({ dateTime, timeZone: 'Europe/Sofia' });
  const now = at('2026-08-21T12:00');
  const base = {
    durationMinutes: 45,
    service: 'Haircut',
    status: 'booked' as const,
  };

  it('returns past non-cancelled visits, newest first', async () => {
    const c = await addClient({ name: 'Maria' });
    await addAppointment({
      ...base,
      clientId: c.id,
      start: at('2026-05-10T10:00'),
    });
    await addAppointment({
      ...base,
      clientId: c.id,
      start: at('2026-07-01T10:00'),
    });
    await addAppointment({
      ...base,
      clientId: c.id,
      start: at('2026-06-01T10:00'),
      status: 'cancelled',
    });
    await addAppointment({
      ...base,
      clientId: c.id,
      start: at('2026-09-01T10:00'),
    }); // future
    const history = await getVisitHistory(c.id, now);
    expect(history.map((a) => a.start.dateTime)).toEqual([
      '2026-07-01T10:00',
      '2026-05-10T10:00',
    ]);
  });

  it('keeps both visits and preserves stable order when start dateTimes are equal', async () => {
    // Fixed ids (rather than addAppointment's random uuids) make the
    // pre-sort order deterministic, since listAppointmentsByClient breaks
    // ties in its underlying index by primary key.
    const c = await addClient({ name: 'Elena' });
    await replaceAllAppointments([
      {
        ...base,
        id: 'a-1',
        clientId: c.id,
        start: at('2026-05-10T10:00'),
        service: 'Haircut',
      },
      {
        ...base,
        id: 'a-2',
        clientId: c.id,
        start: at('2026-05-10T10:00'),
        service: 'Manicure',
      },
      {
        ...base,
        id: 'a-3',
        clientId: c.id,
        start: at('2026-07-01T10:00'),
        service: 'Coloring',
      },
    ]);
    const history = await getVisitHistory(c.id, now);
    expect(history).toHaveLength(3);
    // newest first, and equal-timestamp entries keep their relative order
    // (i.e. neither is dropped, and ties aren't spuriously reversed).
    expect(history.map((a) => a.service)).toEqual([
      'Coloring',
      'Haircut',
      'Manicure',
    ]);
  });
});
