import { describe, expect, it } from 'vitest';
import { appointmentToIcs, icsFileName, type IcsAppointment } from './ics';

const sample: IcsAppointment = {
  id: '3f2b6c1a-9d4e-4f0b-8a7c-1e2d3c4b5a69',
  providerName: 'Салон Арома',
  address: 'ул. Витоша 1, София',
  service: 'Подстригване',
  start: { dateTime: '2026-09-01T15:00', timeZone: 'Europe/Sofia' },
  durationMinutes: 45,
  status: 'booked',
  revision: 2,
  reimportUrl: 'https://p-dim-popov.github.io/when-again/#/r?d=abc123',
};

const now = new Date('2026-08-18T12:34:56.789Z');

/** Undo RFC 5545 line folding so logical lines can be asserted. */
const unfold = (ics: string) => ics.replace(/\r\n /g, '');

const logicalLines = (ics: string) => unfold(ics).split('\r\n').filter(Boolean);

describe('appointmentToIcs', () => {
  it('serializes a booked appointment with all required properties', () => {
    const lines = logicalLines(appointmentToIcs(sample, now));
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(lines.at(-1)).toBe('END:VCALENDAR');
    expect(lines).toContain('VERSION:2.0');
    expect(
      lines.some((l) => l.startsWith('PRODID:') && l.includes('when-again')),
    ).toBe(true);
    expect(lines).toContain('METHOD:PUBLISH');
    expect(lines.filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(1);
    expect(lines).toContain(`UID:${sample.id}@when-again`);
    expect(lines).toContain('SEQUENCE:2');
    expect(lines).toContain('DTSTART;TZID=Europe/Sofia:20260901T150000');
    expect(lines).toContain('DTEND;TZID=Europe/Sofia:20260901T154500');
    expect(lines).toContain('DTSTAMP:20260818T123456Z');
    expect(lines).toContain('STATUS:CONFIRMED');
    expect(
      lines.some(
        (l) =>
          l.startsWith('SUMMARY:') &&
          l.includes('Подстригване') &&
          l.includes('Салон Арома'),
      ),
    ).toBe(true);
    expect(
      lines.some((l) => l.startsWith('LOCATION:') && l.includes('Витоша')),
    ).toBe(true);
  });

  it('emits two display alarms at -P1D and -PT1H, each with a DESCRIPTION', () => {
    const ics = unfold(appointmentToIcs(sample, now));
    const alarms = ics.match(/BEGIN:VALARM[\s\S]*?END:VALARM/g) ?? [];
    expect(alarms).toHaveLength(2);
    expect(alarms[0]).toContain('ACTION:DISPLAY');
    expect(alarms[1]).toContain('ACTION:DISPLAY');
    expect(alarms.some((a) => a.includes('TRIGGER:-P1D'))).toBe(true);
    expect(alarms.some((a) => a.includes('TRIGGER:-PT1H'))).toBe(true);
    for (const alarm of alarms) expect(alarm).toContain('DESCRIPTION:');
  });

  it('marks a cancelled appointment STATUS:CANCELLED with the given sequence', () => {
    const lines = logicalLines(
      appointmentToIcs({ ...sample, status: 'cancelled', revision: 5 }, now),
    );
    expect(lines).toContain('STATUS:CANCELLED');
    expect(lines).toContain('SEQUENCE:5');
    expect(lines).toContain('METHOD:PUBLISH');
  });

  it('defaults a missing revision to SEQUENCE:0 and omits LOCATION without address', () => {
    const lines = logicalLines(
      appointmentToIcs(
        { ...sample, revision: undefined, address: undefined },
        now,
      ),
    );
    expect(lines).toContain('SEQUENCE:0');
    expect(lines.some((l) => l.startsWith('LOCATION'))).toBe(false);
  });

  it('escapes commas, semicolons and newlines in text values', () => {
    const ics = unfold(
      appointmentToIcs(
        { ...sample, service: 'Cut, wash; dry\nand style', address: 'a\\b' },
        now,
      ),
    );
    expect(ics).toContain('Cut\\, wash\\; dry\\nand style');
    expect(ics).toContain('LOCATION:a\\\\b');
  });

  it('keeps the re-import URL intact in DESCRIPTION', () => {
    const lines = logicalLines(appointmentToIcs(sample, now));
    const description = lines.find((l) => l.startsWith('DESCRIPTION:'));
    expect(description).toBeDefined();
    expect(description).toContain(sample.reimportUrl);
  });

  it('folds long lines at 75 octets without splitting multi-byte codepoints', () => {
    const ics = appointmentToIcs(
      {
        ...sample,
        providerName: 'Салон за красота Мария-Антоанета и колектив дълго име',
      },
      now,
    );
    const physical = ics.split('\r\n').filter((l) => l.length > 0);
    const encoder = new TextEncoder();
    let sawFold = false;
    for (const line of physical) {
      const octets = encoder.encode(line).length;
      if (line.startsWith(' ')) {
        sawFold = true;
        expect(octets).toBeLessThanOrEqual(76);
      } else {
        expect(octets).toBeLessThanOrEqual(75);
      }
      // A split codepoint would surface as a replacement char on re-decode.
      expect(line).not.toContain('�');
    }
    expect(sawFold).toBe(true);
    // Unfolding restores the full provider name.
    expect(unfold(ics)).toContain('Мария-Антоанета и колектив дълго име');
  });

  it('ends every line with CRLF, including the last', () => {
    const ics = appointmentToIcs(sample, now);
    expect(ics.endsWith('\r\n')).toBe(true);
    // No bare LF or CR anywhere.
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
  });

  it('computes DTEND across midnight with pure wall-clock arithmetic', () => {
    const lines = logicalLines(
      appointmentToIcs(
        {
          ...sample,
          start: {
            dateTime: '2026-12-31T23:30',
            timeZone: 'Pacific/Kiritimati',
          },
          durationMinutes: 60,
        },
        now,
      ),
    );
    expect(lines).toContain('DTSTART;TZID=Pacific/Kiritimati:20261231T233000');
    expect(lines).toContain('DTEND;TZID=Pacific/Kiritimati:20270101T003000');
  });
});

describe('icsFileName', () => {
  it('names the file after the appointment date', () => {
    expect(icsFileName(sample.start)).toBe(
      'when-again-appointment-2026-09-01.ics',
    );
  });
});
