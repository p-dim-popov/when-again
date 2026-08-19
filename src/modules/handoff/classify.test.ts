import { describe, expect, it } from 'vitest';
import { type ReceivedAppointment } from '../received';
import { classifyImport } from './classify';

function base(): ReceivedAppointment {
  return {
    id: 'appt-1',
    providerName: 'Салон Арома',
    service: 'Подстригване',
    start: { dateTime: '2026-08-15T15:00', timeZone: 'Europe/Sofia' },
    durationMinutes: 45,
    status: 'booked',
  };
}

describe('classifyImport', () => {
  it('is "new" when the id is not stored and status is booked', () => {
    expect(classifyImport(base(), undefined).kind).toBe('new');
  });

  it('is "upToDate" when the stored copy is identical', () => {
    expect(classifyImport(base(), { ...base() }).kind).toBe('upToDate');
  });

  it('is "changed" when a stored booked copy differs', () => {
    const incoming = base();
    const stored = {
      ...incoming,
      start: { dateTime: '2026-08-15T16:00', timeZone: 'Europe/Sofia' },
    };
    const out = classifyImport(incoming, stored);
    expect(out.kind).toBe('changed');
    expect(out.kind === 'changed' && out.stored).toEqual(stored);
  });

  it('is "cancelled" whenever the incoming status is cancelled, seen or not', () => {
    const incoming = { ...base(), status: 'cancelled' as const };
    expect(classifyImport(incoming, undefined).kind).toBe('cancelled');
    expect(classifyImport(incoming, { ...base() }).kind).toBe('cancelled');
  });

  it('treats a status flip (cancelled → booked) as "changed"', () => {
    expect(
      classifyImport(base(), { ...base(), status: 'cancelled' }).kind,
    ).toBe('changed');
  });

  it('a providerId difference alone classifies as changed (legacy row self-heal)', () => {
    const stored = base(); // the file's existing fixture builder, no providerId
    const incoming = { ...base(), providerId: 'prov-1' };
    expect(classifyImport(incoming, stored).kind).toBe('changed');
  });

  it('identical providerId stays upToDate', () => {
    const stored = { ...base(), providerId: 'prov-1' };
    const incoming = { ...base(), providerId: 'prov-1' };
    expect(classifyImport(incoming, stored).kind).toBe('upToDate');
  });

  // Revision gates the outcome BEFORE field comparison (KTD7): a link that
  // carries an older revision than the stored row is refused as 'stale'.
  // Otherwise revision is metadata — fields still decide changed/upToDate.
  describe('revision', () => {
    it('is "stale" when the incoming revision is lower than the stored one (AE1)', () => {
      const stored = { ...base(), revision: 3 };
      const incoming = { ...base(), revision: 2 };
      const out = classifyImport(incoming, stored);
      expect(out.kind).toBe('stale');
      expect(out.kind === 'stale' && out.stored).toEqual(stored);
    });

    it('treats an absent incoming revision as 0, so it is stale against any positive stored revision', () => {
      expect(classifyImport(base(), { ...base(), revision: 1 }).kind).toBe(
        'stale',
      );
    });

    it('equal revisions with identical fields stay upToDate', () => {
      expect(
        classifyImport({ ...base(), revision: 2 }, { ...base(), revision: 2 })
          .kind,
      ).toBe('upToDate');
    });

    it('equal revisions with different fields are changed — fields still decide', () => {
      const incoming = { ...base(), revision: 2, service: 'Боядисване' };
      expect(classifyImport(incoming, { ...base(), revision: 2 }).kind).toBe(
        'changed',
      );
    });

    it('a higher incoming revision over identical fields is upToDate flagged revisionBehind (write-through contract)', () => {
      const out = classifyImport(
        { ...base(), revision: 3 },
        { ...base(), revision: 2 },
      );
      expect(out.kind).toBe('upToDate');
      expect(out.kind === 'upToDate' && out.revisionBehind).toBe(true);
    });

    it('equal revisions are not revisionBehind', () => {
      const out = classifyImport(
        { ...base(), revision: 2 },
        { ...base(), revision: 2 },
      );
      expect(out.kind === 'upToDate' && out.revisionBehind).toBe(false);
    });

    it('a cancellation stays "cancelled" at an equal or higher revision', () => {
      const cancelled = { ...base(), status: 'cancelled' as const };
      expect(
        classifyImport(
          { ...cancelled, revision: 3 },
          { ...base(), revision: 3 },
        ).kind,
      ).toBe('cancelled');
      expect(
        classifyImport(
          { ...cancelled, revision: 4 },
          { ...base(), revision: 3 },
        ).kind,
      ).toBe('cancelled');
    });

    it('a stale cancellation is "stale", not "cancelled"', () => {
      const cancelled = { ...base(), status: 'cancelled' as const };
      expect(
        classifyImport(
          { ...cancelled, revision: 2 },
          { ...base(), revision: 3 },
        ).kind,
      ).toBe('stale');
    });

    it('absent revisions on both sides keep legacy behavior', () => {
      expect(classifyImport(base(), { ...base() }).kind).toBe('upToDate');
      const moved = {
        ...base(),
        start: { dateTime: '2026-08-15T16:00', timeZone: 'Europe/Sofia' },
      };
      expect(classifyImport(moved, { ...base() }).kind).toBe('changed');
      const out = classifyImport(base(), { ...base() });
      expect(out.kind === 'upToDate' && out.revisionBehind).toBe(false);
    });
  });
});
