import type { WallClock } from '../time';

export interface IcsAppointment {
  /** Appointment id (uuid); the UID derives from it, so re-exports update in place. */
  id: string;
  providerName: string;
  address?: string;
  service: string;
  start: WallClock;
  durationMinutes: number;
  status: 'booked' | 'cancelled';
  /** Bumped on every change; absent means 0. Maps to SEQUENCE. */
  revision?: number;
  /** Link back into the app that re-imports this appointment. */
  reimportUrl: string;
}

const PRODID = '-//when-again//appointment reminders//EN';
const MAX_LINE_OCTETS = 75;

const encoder = new TextEncoder();

/** RFC 5545 TEXT escaping: backslash first, then ; , and newlines. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/**
 * Fold a logical line at 75 octets. Continuation lines start with one space
 * (75 content octets + the space). Never splits a multi-byte codepoint:
 * folding advances by whole codepoints, measuring their UTF-8 byte length.
 */
function foldLine(line: string): string[] {
  const physical: string[] = [];
  let current = '';
  let octets = 0;
  let limit = MAX_LINE_OCTETS;
  for (const codepoint of line) {
    const size = encoder.encode(codepoint).length;
    if (octets + size > limit) {
      physical.push(current);
      current = ' ';
      octets = 1;
      limit = MAX_LINE_OCTETS + 1;
    }
    current += codepoint;
    octets += size;
  }
  physical.push(current);
  return physical;
}

/** '2026-09-01T15:00' -> [2026, 9, 1, 15, 0] */
function parseWallClock(
  dateTime: string,
): [number, number, number, number, number] {
  const [date, time] = dateTime.split('T');
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  return [year, month, day, hours, minutes];
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

/**
 * Local date-time in RFC 5545 form (YYYYMMDDTHHMMSS), optionally shifted by
 * whole minutes. The shift is pure calendar arithmetic via Date.UTC getters —
 * the host timezone never participates.
 */
function formatLocal(dateTime: string, addMinutes = 0): string {
  const [year, month, day, hours, minutes] = parseWallClock(dateTime);
  const d = new Date(
    Date.UTC(year, month - 1, day, hours, minutes + addMinutes),
  );
  return (
    `${pad(d.getUTCFullYear(), 4)}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00`
  );
}

/** Current UTC instant as an RFC 5545 DATE-TIME, e.g. 20260818T123456Z. */
function formatUtcStamp(now: Date): string {
  return `${now.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`;
}

export function appointmentToIcs(
  appointment: IcsAppointment,
  now: Date = new Date(),
): string {
  const {
    id,
    providerName,
    address,
    service,
    start,
    durationMinutes,
    status,
    revision,
    reimportUrl,
  } = appointment;

  const summary = escapeText(`${service} — ${providerName}`);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${id}@when-again`,
    `DTSTAMP:${formatUtcStamp(now)}`,
    `SEQUENCE:${revision ?? 0}`,
    `DTSTART;TZID=${start.timeZone}:${formatLocal(start.dateTime)}`,
    `DTEND;TZID=${start.timeZone}:${formatLocal(start.dateTime, durationMinutes)}`,
    `SUMMARY:${summary}`,
    ...(address === undefined ? [] : [`LOCATION:${escapeText(address)}`]),
    `DESCRIPTION:${escapeText(reimportUrl)}`,
    `STATUS:${status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'}`,
    ...alarm('-P1D', summary),
    ...alarm('-PT1H', summary),
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return lines.flatMap(foldLine).join('\r\n') + '\r\n';
}

function alarm(trigger: string, description: string): string[] {
  return [
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `TRIGGER:${trigger}`,
    `DESCRIPTION:${description}`,
    'END:VALARM',
  ];
}

export function icsFileName(start: WallClock): string {
  return `when-again-appointment-${start.dateTime.slice(0, 10)}.ics`;
}
