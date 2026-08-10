import { type ReceivedAppointment } from '../received';
import { type WallClock } from '../time';

// What the provider serialises to hand off one appointment. Maps onto the
// compact wire object below; the client decodes it straight into a
// ReceivedAppointment.
export interface HandoffInput {
  id: string;
  providerName: string;
  address?: string;
  service: string;
  start: WallClock;
  durationMinutes: number;
  status: 'booked' | 'cancelled';
}

const SCHEMA_VERSION = 1;
const DATE_TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

// Compact single-letter wire keys keep the QR small. Chosen over JSURL et al.
// because base64url is uniform over bytes (Cyrillic ~2.67 chars/char) while
// text-preserving encoders escape every non-ASCII byte — a net loss for this
// Bulgarian-first payload — and this is zero-dependency (builtins only).
interface Wire {
  v: number;
  i: string;
  p: string;
  a?: string;
  s: string;
  t: string;
  z: string;
  d: number;
  c: 0 | 1;
}

function toBase64Url(json: string): string {
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(fragment: string): string {
  const b64 = fragment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded); // throws on malformed input
  const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeHandoff(input: HandoffInput): string {
  const wire: Wire = {
    v: SCHEMA_VERSION,
    i: input.id,
    p: input.providerName,
    ...(input.address ? { a: input.address } : {}),
    s: input.service,
    t: input.start.dateTime,
    z: input.start.timeZone,
    d: input.durationMinutes,
    c: input.status === 'cancelled' ? 1 : 0,
  };
  return toBase64Url(JSON.stringify(wire));
}

export type DecodeResult =
  | { ok: true; appointment: ReceivedAppointment }
  | { ok: false; reason: 'malformed' | 'unsupported-version' };

export function decodeHandoff(fragment: string): DecodeResult {
  let raw: unknown;
  try {
    raw = JSON.parse(fromBase64Url(fragment));
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, reason: 'malformed' };
  }
  const d = raw as Record<string, unknown>;
  if (d.v !== SCHEMA_VERSION) {
    return typeof d.v === 'number'
      ? { ok: false, reason: 'unsupported-version' }
      : { ok: false, reason: 'malformed' };
  }
  const isStr = (x: unknown): x is string => typeof x === 'string';
  if (
    !isStr(d.i) ||
    !isStr(d.p) ||
    !isStr(d.s) ||
    !isStr(d.t) ||
    !DATE_TIME_RE.test(d.t) ||
    !isStr(d.z) ||
    typeof d.d !== 'number' ||
    (d.c !== 0 && d.c !== 1) ||
    (d.a !== undefined && !isStr(d.a))
  ) {
    return { ok: false, reason: 'malformed' };
  }
  return {
    ok: true,
    appointment: {
      id: d.i,
      providerName: d.p,
      ...(d.a ? { address: d.a } : {}),
      service: d.s,
      start: { dateTime: d.t, timeZone: d.z },
      durationMinutes: d.d,
      status: d.c === 1 ? 'cancelled' : 'booked',
    },
  };
}

export function buildHandoffUrl(
  input: HandoffInput,
  opts: { origin: string; basePath: string },
): string {
  return `${opts.origin}${opts.basePath}import#${encodeHandoff(input)}`;
}
