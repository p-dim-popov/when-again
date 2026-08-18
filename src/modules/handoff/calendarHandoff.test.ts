import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReceivedAppointment } from '../received';
import { decodeHandoff } from './codec';
import { buildCalendarHandoff, deliverIcs } from './calendarHandoff';

const opts = { origin: 'https://example.test', basePath: '/when-again/' };

const base: ReceivedAppointment = {
  id: 'appt-1',
  providerName: 'Студио Мария',
  address: 'ул. Роза 5',
  service: 'Подстригване',
  start: { dateTime: '2026-09-01T15:00', timeZone: 'Europe/Sofia' },
  durationMinutes: 45,
  status: 'booked',
  revision: 3,
};

// .ics output folds long lines at 75 octets with a leading-space
// continuation; unfold before asserting on logical line content.
const unfold = (ics: string) => ics.replace(/\r\n /g, '');

describe('buildCalendarHandoff', () => {
  it('puts the exact re-import URL in DESCRIPTION (AE4)', () => {
    const { icsText, reimportUrl } = buildCalendarHandoff(
      base,
      { id: 'prov-1', phone: '+359 88 123 4567' },
      opts,
    );
    expect(
      reimportUrl.startsWith('https://example.test/when-again/import#'),
    ).toBe(true);
    expect(unfold(icsText)).toContain(`DESCRIPTION:${reimportUrl}`);
  });

  it('rebuilds a URL that round-trips to the same appointment and provider', () => {
    const { reimportUrl } = buildCalendarHandoff(
      base,
      { id: 'prov-1', phone: '+359 88 123 4567' },
      opts,
    );
    const decoded = decodeHandoff(reimportUrl.split('#')[1]);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.appointment).toEqual(base);
    expect(decoded.provider).toEqual({
      id: 'prov-1',
      phone: '+359 88 123 4567',
    });
  });

  it('derives SEQUENCE from the given record revision (import screen: payload; card: stored row)', () => {
    const { icsText, reimportUrl } = buildCalendarHandoff(base, {}, opts);
    expect(unfold(icsText)).toContain('SEQUENCE:3');
    const decoded = decodeHandoff(reimportUrl.split('#')[1]);
    expect(decoded.ok && decoded.appointment.revision).toBe(3);
  });

  it('treats an absent revision as 0', () => {
    const legacy: ReceivedAppointment = { ...base };
    delete legacy.revision;
    const { icsText, reimportUrl } = buildCalendarHandoff(legacy, {}, opts);
    expect(unfold(icsText)).toContain('SEQUENCE:0');
    const decoded = decodeHandoff(reimportUrl.split('#')[1]);
    expect(decoded.ok && decoded.appointment.revision).toBe(0);
  });

  it('maps a cancelled appointment to STATUS:CANCELLED and a cancelled payload', () => {
    const cancelled: ReceivedAppointment = { ...base, status: 'cancelled' };
    const { icsText, reimportUrl } = buildCalendarHandoff(cancelled, {}, opts);
    expect(unfold(icsText)).toContain('STATUS:CANCELLED');
    const decoded = decodeHandoff(reimportUrl.split('#')[1]);
    expect(decoded.ok && decoded.appointment.status).toBe('cancelled');
  });

  it('omits absent provider identity/contact from the wire', () => {
    const { reimportUrl } = buildCalendarHandoff(base, {}, opts);
    const decoded = decodeHandoff(reimportUrl.split('#')[1]);
    expect(decoded.ok && decoded.provider).toEqual({});
  });

  it('names the file from the start date', () => {
    const { fileName } = buildCalendarHandoff(base, {}, opts);
    expect(fileName).toBe('when-again-appointment-2026-09-01.ics');
  });
});

describe('deliverIcs', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('shares a text/calendar file via the share sheet when supported', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const canShare = vi.fn().mockReturnValue(true);
    vi.stubGlobal('navigator', { canShare, share });
    await deliverIcs('BEGIN:VCALENDAR', 'a.ics');
    expect(share).toHaveBeenCalledTimes(1);
    const shared = share.mock.calls[0][0] as { files: File[] };
    expect(shared.files).toHaveLength(1);
    expect(shared.files[0].name).toBe('a.ics');
    expect(shared.files[0].type).toBe('text/calendar');
  });

  it('resolves quietly when the user dismisses the share sheet', async () => {
    vi.stubGlobal('navigator', {
      canShare: () => true,
      share: vi
        .fn()
        .mockRejectedValue(new DOMException('canceled', 'AbortError')),
    });
    await expect(deliverIcs('X', 'a.ics')).resolves.toBeUndefined();
  });

  it('falls back to a blob-anchor download with a deferred revoke', async () => {
    vi.stubGlobal('navigator', {});
    const anchor = { href: '', download: '', click: vi.fn(), remove: vi.fn() };
    vi.stubGlobal('document', {
      createElement: vi.fn(() => anchor),
      body: { appendChild: vi.fn() },
    });
    const createObjectURL = vi.fn(() => 'blob:mock');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    vi.useFakeTimers();
    await deliverIcs('X', 'a.ics');
    expect(anchor.href).toBe('blob:mock');
    expect(anchor.download).toBe('a.ics');
    expect(anchor.click).toHaveBeenCalledTimes(1);
    expect(anchor.remove).toHaveBeenCalledTimes(1);
    // WebKit hazard: the revoke must be deferred a tick, not synchronous.
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock');
  });
});
