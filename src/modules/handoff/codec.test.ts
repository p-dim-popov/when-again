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
        revision: 0,
      },
      provider: {},
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

  it('round-trips providerId and phone via k/f', () => {
    const encoded = encodeHandoff({
      id: 'a1',
      providerName: 'Студио Мария',
      service: 'Подстригване',
      start: { dateTime: '2026-09-01T15:00', timeZone: 'Europe/Sofia' },
      durationMinutes: 30,
      status: 'booked',
      providerId: 'prov-1',
      phone: '+359 88 123 4567',
    });
    const decoded = decodeHandoff(encoded);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.provider).toEqual({
      id: 'prov-1',
      phone: '+359 88 123 4567',
    });
    expect('providerId' in decoded.appointment).toBe(false);
  });

  it('decodes a payload without k/f (pre-field payloads stay valid)', () => {
    const encoded = encodeHandoff({
      id: 'a1',
      providerName: 'Студио Мария',
      service: 'Подстригване',
      start: { dateTime: '2026-09-01T15:00', timeZone: 'Europe/Sofia' },
      durationMinutes: 30,
      status: 'booked',
    });
    const decoded = decodeHandoff(encoded);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.provider).toEqual({});
  });

  it('round-trips the revision via r', () => {
    const r = decodeHandoff(encodeHandoff({ ...input, revision: 3 }));
    expect(r.ok && r.appointment.revision).toBe(3);
  });

  it('decodes a payload without r to revision 0 (pre-field payloads)', () => {
    // `input` carries no revision, so the encoder omits `r` — same wire shape
    // as a payload built before the field existed.
    const r = decodeHandoff(encodeHandoff(input));
    expect(r.ok && r.appointment.revision).toBe(0);
  });

  it('rejects a non-numeric r as malformed', () => {
    const wire = {
      v: 1,
      i: 'a1',
      p: 'X',
      s: 'Y',
      t: '2026-09-01T15:00',
      z: 'Europe/Sofia',
      d: 30,
      c: 0,
      r: 'high',
    };
    const fragment = btoa(
      String.fromCharCode(...new TextEncoder().encode(JSON.stringify(wire))),
    )
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect(decodeHandoff(fragment)).toEqual({ ok: false, reason: 'malformed' });
  });

  // Craft a raw wire fragment directly (bypassing encodeHandoff) so tests
  // can probe decode-side validation of values the encoder never emits.
  const wireFragment = (wire: object): string =>
    btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(wire))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

  const baseWire = {
    v: 1,
    i: 'a1',
    p: 'X',
    s: 'Y',
    t: '2026-09-01T15:00',
    z: 'Europe/Sofia',
    d: 30,
    c: 0,
  };

  it('rejects a non-integer r as malformed', () => {
    expect(decodeHandoff(wireFragment({ ...baseWire, r: 1.5 }))).toEqual({
      ok: false,
      reason: 'malformed',
    });
  });

  it('rejects a negative r as malformed', () => {
    expect(decodeHandoff(wireFragment({ ...baseWire, r: -1 }))).toEqual({
      ok: false,
      reason: 'malformed',
    });
  });

  it('rejects an r above the ceiling as malformed', () => {
    expect(decodeHandoff(wireFragment({ ...baseWire, r: 1e15 }))).toEqual({
      ok: false,
      reason: 'malformed',
    });
  });

  it('decodes an explicit r: 0 (encode omits it, but the wire allows it)', () => {
    const r = decodeHandoff(wireFragment({ ...baseWire, r: 0 }));
    expect(r.ok && r.appointment.revision).toBe(0);
  });

  it('rejects a non-string k or f as malformed', () => {
    const wire = {
      v: 1,
      i: 'a1',
      p: 'X',
      s: 'Y',
      t: '2026-09-01T15:00',
      z: 'Europe/Sofia',
      d: 30,
      c: 0,
      k: 7,
    };
    const fragment = btoa(
      String.fromCharCode(...new TextEncoder().encode(JSON.stringify(wire))),
    )
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect(decodeHandoff(fragment)).toEqual({ ok: false, reason: 'malformed' });
  });
});
