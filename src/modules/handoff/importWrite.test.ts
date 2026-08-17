import { describe, expect, it } from 'vitest';
import { getReceived, listReceived, upsertReceived } from '../received';
import { getSavedProvider, listSavedProviders } from '../savedProviders';
import { applyHandoffImport, enrichWithProviderKey } from './importWrite';

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

  it('adopts a legacy received row on update (self-heal)', async () => {
    await upsertReceived(appt()); // pre-#7 row, no providerId
    await applyHandoffImport(enrichWithProviderKey(appt(), 'prov-1'));
    expect((await getReceived('a1'))?.providerId).toBe('prov-1');
    expect((await listReceived()).length).toBe(1);
  });
});
