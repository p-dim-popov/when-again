import { describe, expect, it } from 'vitest';
import {
  buildHandoffUrl,
  decodeHandoff,
  encodeHandoff,
  type HandoffInput,
} from './codec';

const input: HandoffInput = {
  id: 'appt-1',
  providerName: 'Салон Арома',
  address: 'ул. Витоша 1',
  service: 'Подстригване',
  start: { dateTime: '2026-08-15T15:00', timeZone: 'Europe/Sofia' },
  durationMinutes: 45,
  status: 'booked',
};

describe('handoff codec', () => {
  it('round-trips a Cyrillic payload', () => {
    const result = decodeHandoff(encodeHandoff(input));
    expect(result).toEqual({
      ok: true,
      appointment: {
        id: 'appt-1',
        providerName: 'Салон Арома',
        address: 'ул. Витоша 1',
        service: 'Подстригване',
        start: { dateTime: '2026-08-15T15:00', timeZone: 'Europe/Sofia' },
        durationMinutes: 45,
        status: 'booked',
      },
    });
  });

  it('omits an empty address and decodes it as undefined', () => {
    const r = decodeHandoff(encodeHandoff({ ...input, address: undefined }));
    expect(r.ok && r.appointment.address).toBeUndefined();
  });

  it('encodes a cancellation (status → c:1)', () => {
    const r = decodeHandoff(encodeHandoff({ ...input, status: 'cancelled' }));
    expect(r.ok && r.appointment.status).toBe('cancelled');
  });

  it('rejects malformed base64/JSON', () => {
    expect(decodeHandoff('not-valid!!')).toEqual({
      ok: false,
      reason: 'malformed',
    });
  });

  it('rejects an unknown schema version', () => {
    // A well-formed payload but v:2.
    const bytes = new TextEncoder().encode(JSON.stringify({ v: 2, i: 'x' }));
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    const frag = btoa(bin)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect(decodeHandoff(frag)).toEqual({
      ok: false,
      reason: 'unsupported-version',
    });
  });

  it('rejects a payload with a missing/wrong-typed field', () => {
    const bytes = new TextEncoder().encode(
      JSON.stringify({
        v: 1,
        i: 'x',
        p: 'P',
        s: 'S',
        t: 'bad',
        z: 'Z',
        d: 30,
        c: 0,
      }),
    );
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    const frag = btoa(bin)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect(decodeHandoff(frag)).toEqual({ ok: false, reason: 'malformed' });
  });

  it('builds an absolute URL from origin + base path (no hardcoding)', () => {
    const url = buildHandoffUrl(input, {
      origin: 'https://example.com',
      basePath: '/when-again/',
    });
    expect(url.startsWith('https://example.com/when-again/import#')).toBe(true);
    const frag = url.slice(url.indexOf('#') + 1);
    expect(decodeHandoff(frag).ok).toBe(true);
  });
});
