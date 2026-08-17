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
  /** Minted provider identity (ADR-0002). Optional: absent pre-#7 payloads. */
  providerId?: string;
  /** Provider phone, free-text as entered in Settings → Profile. */
  phone?: string;
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
  // k: provider id, f: phone — optional, added by #7 sub-project 2; decode ignores unknown keys, so these are v:1-compatible both directions (ADR-0002)
  k?: string;
  f?: string;
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
    ...(input.providerId ? { k: input.providerId } : {}),
    ...(input.phone ? { f: input.phone } : {}),
  };
  return toBase64Url(JSON.stringify(wire));
}

export type DecodeResult =
  | {
      ok: true;
      appointment: ReceivedAppointment;
      /** Provider identity/contact riding alongside the appointment. The
       * import flow (not the codec) resolves the grouping key, because the
       * synthetic-name fallback lives in savedProviders. */
      provider: { id?: string; phone?: string };
    }
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
    (d.a !== undefined && !isStr(d.a)) ||
    (d.k !== undefined && !isStr(d.k)) ||
    (d.f !== undefined && !isStr(d.f))
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
    provider: {
      ...(isStr(d.k) && d.k ? { id: d.k } : {}),
      ...(isStr(d.f) && d.f ? { phone: d.f } : {}),
    },
  };
}

export function buildHandoffUrl(
  input: HandoffInput,
  opts: { origin: string; basePath: string },
): string {
  return `${opts.origin}${opts.basePath}import#${encodeHandoff(input)}`;
}
