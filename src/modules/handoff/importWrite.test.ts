import { describe, expect, it } from 'vitest';
import { getReceived, listReceived, upsertReceived } from '../received';
import { getSavedProvider, listSavedProviders } from '../savedProviders';
import {
  applyHandoffImport,
  catchUpReceivedRevision,
  enrichWithProviderKey,
} from './importWrite';

const appt = (over: object = {}) => ({
  id: 'a1',
  providerName: 'Студио Мария',
  address: 'ул. Роза 5',
  service: 'Подстригване',
  start: { dateTime: '2026-09-01T15:00', timeZone: 'Europe/Sofia' },
  durationMinutes: 30,
  status: 'booked' as const,
  ...over,
});

describe('enrichWithProviderKey', () => {
  it('uses the payload id when present', () => {
    expect(enrichWithProviderKey(appt(), 'prov-1').providerId).toBe('prov-1');
  });
  it('falls back to the synthetic name key', () => {
    expect(enrichWithProviderKey(appt()).providerId).toBe('name:студио мария');
  });
});

describe('applyHandoffImport', () => {
  it('writes saved provider and received row, linked', async () => {
    const incoming = enrichWithProviderKey(appt(), 'prov-1');
    await applyHandoffImport(incoming, '+359 88 123 4567');
    expect(await getSavedProvider('prov-1')).toEqual({
      id: 'prov-1',
      name: 'Студио Мария',
      address: 'ул. Роза 5',
      phone: '+359 88 123 4567',
    });
    expect((await getReceived('a1'))?.providerId).toBe('prov-1');
  });

  it('is idempotent: re-import leaves exactly one of each', async () => {
    const incoming = enrichWithProviderKey(appt(), 'prov-1');
    await applyHandoffImport(incoming, undefined);
    await applyHandoffImport(incoming, undefined);
    expect((await listReceived()).length).toBe(1);
    expect((await listSavedProviders()).length).toBe(1);
  });

  it('heals attributes on re-import (rename + new phone)', async () => {
    await applyHandoffImport(enrichWithProviderKey(appt(), 'prov-1'));
    await applyHandoffImport(
      enrichWithProviderKey(
        appt({ providerName: 'Студио Мария ✂️' }),
        'prov-1',
      ),
      '+359 88 000 0000',
    );
    const stored = await getSavedProvider('prov-1');
    expect(stored?.name).toBe('Студио Мария ✂️');
    expect(stored?.phone).toBe('+359 88 000 0000');
    expect((await listSavedProviders()).length).toBe(1);
  });

  it('id-less payloads group under the synthetic record', async () => {
    await applyHandoffImport(enrichWithProviderKey(appt()));
    const stored = await getSavedProvider('name:студио мария');
    expect(stored?.name).toBe('Студио Мария');
  });

  it('no-ops a stale write: a lower incoming revision leaves everything untouched', async () => {
    await applyHandoffImport(
      enrichWithProviderKey(appt({ revision: 3 }), 'prov-1'),
      '+359 88 111 1111',
    );
    await applyHandoffImport(
      enrichWithProviderKey(
        appt({
          revision: 1,
          service: 'Боядисване',
          providerName: 'Друго име',
        }),
        'prov-1',
      ),
      '+359 88 999 9999',
    );
    const stored = await getReceived('a1');
    expect(stored?.revision).toBe(3);
    expect(stored?.service).toBe('Подстригване');
    // The stale no-op must not touch savedProviders either.
    const provider = await getSavedProvider('prov-1');
    expect(provider?.name).toBe('Студио Мария');
    expect(provider?.phone).toBe('+359 88 111 1111');
  });

  it('overwrites in place on an equal revision', async () => {
    await applyHandoffImport(
      enrichWithProviderKey(appt({ revision: 3 }), 'prov-1'),
    );
    await applyHandoffImport(
      enrichWithProviderKey(
        appt({ revision: 3, service: 'Боядисване' }),
        'prov-1',
      ),
    );
    const stored = await getReceived('a1');
    expect(stored?.revision).toBe(3);
    expect(stored?.service).toBe('Боядисване');
  });

  it('applies a higher revision', async () => {
    await applyHandoffImport(
      enrichWithProviderKey(appt({ revision: 3 }), 'prov-1'),
    );
    await applyHandoffImport(
      enrichWithProviderKey(
        appt({ revision: 4, service: 'Боядисване' }),
        'prov-1',
      ),
    );
    const stored = await getReceived('a1');
    expect(stored?.revision).toBe(4);
    expect(stored?.service).toBe('Боядисване');
  });

  it('inserts when no row is stored yet (revision carried through)', async () => {
    await applyHandoffImport(
      enrichWithProviderKey(appt({ revision: 2 }), 'prov-1'),
    );
    const stored = await getReceived('a1');
    expect(stored?.revision).toBe(2);
    expect(stored?.providerId).toBe('prov-1');
  });

  it('adopts a legacy received row on update (self-heal)', async () => {
    await upsertReceived(appt()); // pre-#7 row, no providerId
    await applyHandoffImport(enrichWithProviderKey(appt(), 'prov-1'));
    expect((await getReceived('a1'))?.providerId).toBe('prov-1');
    expect((await listReceived()).length).toBe(1);
  });
});

// The silent upToDate/revisionBehind write-through must be exactly a
// revision catch-up: no saved-provider attribute may move without a user
// interaction (a crafted link could otherwise replace a tap-to-call phone
// on mere open).
describe('catchUpReceivedRevision', () => {
  async function seed() {
    await applyHandoffImport(
      enrichWithProviderKey(appt({ revision: 1 }), 'prov-1'),
      '+359 88 123 4567',
    );
    const stored = await getReceived('a1');
    if (!stored) throw new Error('seed row missing');
    return stored;
  }

  it('writes only the revision onto the stored row', async () => {
    const stored = await seed();
    await catchUpReceivedRevision(stored, 3);
    expect(await getReceived('a1')).toEqual({ ...stored, revision: 3 });
    expect((await listReceived()).length).toBe(1);
  });

  it('never touches saved-provider attributes', async () => {
    const stored = await seed();
    const providerBefore = await getSavedProvider('prov-1');
    await catchUpReceivedRevision(stored, 5);
    expect(await getSavedProvider('prov-1')).toEqual(providerBefore);
    expect((await listSavedProviders()).length).toBe(1);
  });
});
