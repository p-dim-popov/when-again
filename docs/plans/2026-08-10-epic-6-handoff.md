# Epic 6 — Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hand a booked appointment from the provider's phone to the client's — as a QR code or share link — and import it cleanly (new / changed / cancelled), with no server and no duplicates.

**Architecture:** Two new modules. `received` (low entity, peer of `appointments`) owns a client-side store of appointments imported from salons. `handoff` (high module) owns a pure payload codec (compact-keyed JSON → base64url in the URL fragment), a pure import classifier, the provider share widget (QR via `qrcode.react`), and the client import screen behind a new `/import` route. `booking → handoff`; `handoff` never imports `booking`.

**Tech Stack:** React + TanStack Router (file-based) + TanStack Query, TypeScript strict, IndexedDB via `idb`, Tailwind v4 utilities-in-JSX, Vitest (logic) + Playwright (e2e), `qrcode.react` (new).

## Global Constraints

- **Modulith:** cross-module imports go through each module's `index.ts` only; the graph stays acyclic. `handoff` must **not** import `booking`; `schedule` must **not** import `booking`. `db` holds store names/indexes only — each entity module owns its own type.
- **No hardcoded base path:** never write `/when-again/` in app code; the payload URL is built from `window.location.origin` + `import.meta.env.BASE_URL` (passed into the pure builder as params).
- **Payload privacy:** appointment data rides in the URL **fragment** only — never in the path or query, never sent to any host.
- **Data/time:** appointments store a **wall-clock** `{ dateTime: 'YYYY-MM-DDTHH:mm', timeZone: <IANA> }`; the client displays the literal time (no conversion). IDs are `crypto.randomUUID()` strings (the provider's appointment id is the dedupe key).
- **Styling:** Tailwind v4 utilities in JSX; no `dark:` variants (tokens flip); no per-module CSS files. The QR renders on an explicit high-contrast white card (dark modules on white) for scan reliability, **not** themed to dark tokens.
- **i18n:** every module owns a `strings.ts` (en + bg) that augments `TranslationKeys`; register at the composition root (`src/app/main.tsx`); a parity test asserts en/bg key sets match. STE applies to user-facing copy; **BG copy is draft** (native-speaker pass deferred).
- **Tooling:** package manager is **npm** (commit `package-lock.json`); TypeScript pinned `~6.0.3` (do not loosen). Before each commit run **`npm run format:check` (Prettier) AND `npm run lint` (ESLint) — they are separate gates** — plus `npm run typecheck`.
- **Tests:** Vitest is logic-only (no DOM/layout); DOM behavior is covered by Playwright e2e. Unit test files are `src/**/*.test.ts`; e2e in `e2e/`.
- **No CDN:** all assets self-hosted; `qrcode.react` renders locally (no network).

---

## File Structure

**New — `received` module** (`src/modules/received/`):
- `received.ts` — `ReceivedAppointment` type + store CRUD (`getReceived`, `upsertReceived`, `listReceived`).
- `index.ts` — public API.
- `received.test.ts` — CRUD + migration on `fake-indexeddb`.

**New — `handoff` module** (`src/modules/handoff/`):
- `codec.ts` — `HandoffInput` type, `encodeHandoff`, `decodeHandoff`, `buildHandoffUrl` (pure).
- `codec.test.ts` — round-trip, rejections, URL building.
- `classify.ts` — `ImportOutcome` type, `classifyImport` (pure).
- `classify.test.ts` — the classification matrix.
- `strings.ts` + `strings.test.ts` — `handoff.*` en/bg + parity.
- `HandoffShare.tsx` — provider share widget (QR + share/copy).
- `ImportScreen.tsx` — client import screen (decode → classify → write).
- `index.ts` — public API.

**Modified:**
- `src/modules/db/db.ts` — add `STORE_RECEIVED`, bump `openDB` version 1 → 2 with an `oldVersion` guard.
- `src/modules/db/index.ts` — export `STORE_RECEIVED`.
- `src/modules/db/db.test.ts` — the store-name-set assertion now includes `received`.
- `src/modules/booking/ShareLanding.tsx` — replace the disabled "Сподели" button with `<HandoffShare>`.
- `src/app/routes/import.tsx` — **new** route file rendering `<ImportScreen>`.
- `src/app/main.tsx` — register `handoffStrings`.
- `package.json` / `package-lock.json` — add `qrcode.react`.
- `e2e/handoff.spec.ts` — **new** e2e (import state matrix + full round-trip).

---

## Task 1: `received` module — store + CRUD + migration

**Files:**
- Modify: `src/modules/db/db.ts`, `src/modules/db/index.ts`, `src/modules/db/db.test.ts`
- Create: `src/modules/received/received.ts`, `src/modules/received/index.ts`, `src/modules/received/received.test.ts`

**Interfaces:**
- Consumes: `getDb` and store-name constants from `db`; `WallClock` from `time`.
- Produces:
  - `interface ReceivedAppointment { id: string; providerName: string; address?: string; service: string; start: WallClock; durationMinutes: number; status: 'booked' | 'cancelled' }`
  - `getReceived(id: string): Promise<ReceivedAppointment | undefined>`
  - `upsertReceived(appt: ReceivedAppointment): Promise<void>`
  - `listReceived(): Promise<ReceivedAppointment[]>`
  - `db`: `STORE_RECEIVED = 'received'`

> Note: no `markReceivedCancelled` — a cancellation payload arrives with `status: 'cancelled'`, so the import writes it via `upsertReceived` like any other outcome (overwrite-by-id). One write path, keyed by id, is what makes re-scanning idempotent.

- [ ] **Step 1: Add the store constant + migration to `db.ts`**

In `src/modules/db/db.ts`, add the constant beside the others:
```ts
export const STORE_RECEIVED = 'received';
```
Change the `openDB(DB_NAME, 1, {...})` call to version `2` and guard the upgrade by `oldVersion` so existing v1 databases keep their data and only gain the new store:
```ts
  dbPromise = openDB(DB_NAME, 2, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore(STORE_CLIENTS, { keyPath: 'id' });
        const appointments = db.createObjectStore(STORE_APPOINTMENTS, {
          keyPath: 'id',
        });
        appointments.createIndex(INDEX_APPOINTMENTS_BY_CLIENT, 'clientId');
        appointments.createIndex(
          INDEX_APPOINTMENTS_BY_DATETIME,
          'start.dateTime',
        );
        db.createObjectStore(STORE_SETTINGS, { keyPath: 'id' });
      }
      if (oldVersion < 2) {
        db.createObjectStore(STORE_RECEIVED, { keyPath: 'id' });
      }
    },
    terminated() {
      dbPromise = null;
    },
  })
```
Export `STORE_RECEIVED` from `src/modules/db/index.ts` alongside the other store names.

- [ ] **Step 2: Update the `db.test.ts` store-set assertion**

The existing test asserts the exact set of object stores. Find the assertion listing `[STORE_APPOINTMENTS, STORE_CLIENTS, STORE_SETTINGS]` and add `STORE_RECEIVED` (import it too) so it reads (sorted compare):
```ts
expect([...db.objectStoreNames].sort()).toEqual(
  [
    STORE_APPOINTMENTS,
    STORE_CLIENTS,
    STORE_RECEIVED,
    STORE_SETTINGS,
  ].sort(),
);
```

- [ ] **Step 3: Write the failing `received` CRUD test**

Create `src/modules/received/received.test.ts`:
```ts
import { afterEach, describe, expect, it } from 'vitest';
import { destroyDb } from '../db';
import {
  getReceived,
  listReceived,
  upsertReceived,
  type ReceivedAppointment,
} from './received';

const sample: ReceivedAppointment = {
  id: 'appt-1',
  providerName: 'Салон Арома',
  address: 'ул. Витоша 1',
  service: 'Подстригване',
  start: { dateTime: '2026-08-15T15:00', timeZone: 'Europe/Sofia' },
  durationMinutes: 45,
  status: 'booked',
};

afterEach(async () => {
  await destroyDb();
});

describe('received store', () => {
  it('returns undefined for an unknown id', async () => {
    expect(await getReceived('missing')).toBeUndefined();
  });

  it('upserts and reads back by id', async () => {
    await upsertReceived(sample);
    expect(await getReceived('appt-1')).toEqual(sample);
  });

  it('overwrites in place on a second upsert with the same id', async () => {
    await upsertReceived(sample);
    await upsertReceived({ ...sample, status: 'cancelled' });
    expect((await getReceived('appt-1'))?.status).toBe('cancelled');
    expect(await listReceived()).toHaveLength(1);
  });

  it('lists all received appointments', async () => {
    await upsertReceived(sample);
    await upsertReceived({ ...sample, id: 'appt-2' });
    expect((await listReceived()).map((a) => a.id).sort()).toEqual([
      'appt-1',
      'appt-2',
    ]);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx vitest run src/modules/received/received.test.ts`
Expected: FAIL — `./received` has no such exports yet.

- [ ] **Step 5: Implement `received.ts` and `index.ts`**

Create `src/modules/received/received.ts`:
```ts
import { getDb, STORE_RECEIVED } from '../db';
import { type WallClock } from '../time';

// An appointment the CLIENT received from a salon (via the handoff QR/link),
// stored on the client device. Distinct from the provider's own
// `appointments` store: it carries the provider's name/address and has no
// local clientId. Keyed by the provider's appointment id so a reshare
// overwrites in place. #7's "salons" home builds on this store.
export interface ReceivedAppointment {
  id: string;
  providerName: string;
  address?: string;
  service: string;
  start: WallClock;
  durationMinutes: number;
  status: 'booked' | 'cancelled';
}

export async function getReceived(
  id: string,
): Promise<ReceivedAppointment | undefined> {
  const db = await getDb();
  return (await db.get(STORE_RECEIVED, id)) as ReceivedAppointment | undefined;
}

export async function upsertReceived(
  appt: ReceivedAppointment,
): Promise<void> {
  const db = await getDb();
  await db.put(STORE_RECEIVED, appt);
}

export async function listReceived(): Promise<ReceivedAppointment[]> {
  const db = await getDb();
  return (await db.getAll(STORE_RECEIVED)) as ReceivedAppointment[];
}
```
Create `src/modules/received/index.ts`:
```ts
export {
  getReceived,
  listReceived,
  upsertReceived,
} from './received';
export type { ReceivedAppointment } from './received';
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/modules/received/received.test.ts src/modules/db/db.test.ts`
Expected: PASS (both files).

- [ ] **Step 7: Lint, format, typecheck, commit**

```bash
npm run typecheck && npm run lint && npm run format:check
git add src/modules/received src/modules/db
git commit -m "feat: add received module + store for imported appointments (#6)"
```

---

## Task 2: `handoff` pure core — codec + classifier

**Files:**
- Create: `src/modules/handoff/codec.ts`, `src/modules/handoff/codec.test.ts`, `src/modules/handoff/classify.ts`, `src/modules/handoff/classify.test.ts`

**Interfaces:**
- Consumes: `ReceivedAppointment`, `WallClock` (types only).
- Produces:
  - `interface HandoffInput { id: string; providerName: string; address?: string; service: string; start: WallClock; durationMinutes: number; status: 'booked' | 'cancelled' }`
  - `encodeHandoff(input: HandoffInput): string` — the base64url fragment.
  - `type DecodeResult = { ok: true; appointment: ReceivedAppointment } | { ok: false; reason: 'malformed' | 'unsupported-version' }`
  - `decodeHandoff(fragment: string): DecodeResult`
  - `buildHandoffUrl(input: HandoffInput, opts: { origin: string; basePath: string }): string`
  - `type ImportOutcome = { kind: 'new'; incoming: ReceivedAppointment } | { kind: 'changed'; incoming: ReceivedAppointment; stored: ReceivedAppointment } | { kind: 'cancelled'; incoming: ReceivedAppointment } | { kind: 'upToDate'; incoming: ReceivedAppointment }`
  - `classifyImport(incoming: ReceivedAppointment, stored: ReceivedAppointment | undefined): ImportOutcome`

- [ ] **Step 1: Write the failing codec test**

Create `src/modules/handoff/codec.test.ts`:
```ts
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
    const frag = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(decodeHandoff(frag)).toEqual({
      ok: false,
      reason: 'unsupported-version',
    });
  });

  it('rejects a payload with a missing/wrong-typed field', () => {
    const bytes = new TextEncoder().encode(
      JSON.stringify({ v: 1, i: 'x', p: 'P', s: 'S', t: 'bad', z: 'Z', d: 30, c: 0 }),
    );
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    const frag = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/modules/handoff/codec.test.ts`
Expected: FAIL — `./codec` does not exist.

- [ ] **Step 3: Implement `codec.ts`**

Create `src/modules/handoff/codec.ts`:
```ts
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
```

- [ ] **Step 4: Run to verify codec tests pass**

Run: `npx vitest run src/modules/handoff/codec.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing classifier test**

Create `src/modules/handoff/classify.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { type ReceivedAppointment } from '../received';
import { classifyImport } from './classify';

const base: ReceivedAppointment = {
  id: 'appt-1',
  providerName: 'Салон Арома',
  service: 'Подстригване',
  start: { dateTime: '2026-08-15T15:00', timeZone: 'Europe/Sofia' },
  durationMinutes: 45,
  status: 'booked',
};

describe('classifyImport', () => {
  it('is "new" when the id is not stored and status is booked', () => {
    expect(classifyImport(base, undefined).kind).toBe('new');
  });

  it('is "upToDate" when the stored copy is identical', () => {
    expect(classifyImport(base, { ...base }).kind).toBe('upToDate');
  });

  it('is "changed" when a stored booked copy differs', () => {
    const stored = { ...base, start: { dateTime: '2026-08-15T16:00', timeZone: 'Europe/Sofia' } };
    const out = classifyImport(base, stored);
    expect(out.kind).toBe('changed');
    expect(out.kind === 'changed' && out.stored).toEqual(stored);
  });

  it('is "cancelled" whenever the incoming status is cancelled, seen or not', () => {
    const incoming = { ...base, status: 'cancelled' as const };
    expect(classifyImport(incoming, undefined).kind).toBe('cancelled');
    expect(classifyImport(incoming, { ...base }).kind).toBe('cancelled');
  });

  it('treats a status flip (cancelled → booked) as "changed"', () => {
    expect(classifyImport(base, { ...base, status: 'cancelled' }).kind).toBe(
      'changed',
    );
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `npx vitest run src/modules/handoff/classify.test.ts`
Expected: FAIL — `./classify` does not exist.

- [ ] **Step 7: Implement `classify.ts`**

Create `src/modules/handoff/classify.ts`:
```ts
import { type ReceivedAppointment } from '../received';

export type ImportOutcome =
  | { kind: 'new'; incoming: ReceivedAppointment }
  | { kind: 'changed'; incoming: ReceivedAppointment; stored: ReceivedAppointment }
  | { kind: 'cancelled'; incoming: ReceivedAppointment }
  | { kind: 'upToDate'; incoming: ReceivedAppointment };

// Compare every field except the id (the lookup key). A status flip counts
// as a change, so a re-book after a cancel surfaces as "changed".
function sameFields(a: ReceivedAppointment, b: ReceivedAppointment): boolean {
  return (
    a.providerName === b.providerName &&
    a.address === b.address &&
    a.service === b.service &&
    a.start.dateTime === b.start.dateTime &&
    a.start.timeZone === b.start.timeZone &&
    a.durationMinutes === b.durationMinutes &&
    a.status === b.status
  );
}

// A cancellation is always a cancellation (even for an appointment never seen
// — the client still learns it is off). Otherwise: unseen → new; seen and
// identical → upToDate; seen and different → changed.
export function classifyImport(
  incoming: ReceivedAppointment,
  stored: ReceivedAppointment | undefined,
): ImportOutcome {
  if (incoming.status === 'cancelled') return { kind: 'cancelled', incoming };
  if (!stored) return { kind: 'new', incoming };
  return sameFields(incoming, stored)
    ? { kind: 'upToDate', incoming }
    : { kind: 'changed', incoming, stored };
}
```

- [ ] **Step 8: Run to verify all handoff-core tests pass**

Run: `npx vitest run src/modules/handoff`
Expected: PASS.

- [ ] **Step 9: Lint, format, typecheck, commit**

```bash
npm run typecheck && npm run lint && npm run format:check
git add src/modules/handoff/codec.ts src/modules/handoff/codec.test.ts src/modules/handoff/classify.ts src/modules/handoff/classify.test.ts
git commit -m "feat: add handoff payload codec + import classifier (#6)"
```

---

## Task 3: `handoff` strings + i18n registration

**Files:**
- Create: `src/modules/handoff/strings.ts`, `src/modules/handoff/strings.test.ts`
- Modify: `src/app/main.tsx`

**Interfaces:**
- Consumes: `Strings` type + `declare module '../i18n'` augmentation pattern (see `booking/strings.ts`).
- Produces: `handoffStrings = { en, bg }` exported from `handoff/index.ts` (added in Task 4's index, but export from `strings.ts` now); the `handoff.*` translation keys usable via `t(...)`.

- [ ] **Step 1: Write `strings.ts`**

Create `src/modules/handoff/strings.ts` (EN + BG draft; BG pending native-speaker pass):
```ts
import type { Strings } from '../i18n';

const en = {
  // Provider share widget
  'handoff.share.link': 'Share link',
  'handoff.share.copy': 'Copy link',
  'handoff.share.copied': 'Link copied',
  'handoff.share.copyFailed': "Couldn't copy the link",
  'handoff.share.setNameHint':
    'Set your name in Settings so clients see who the appointment is from.',
  // Import screen — titles
  'handoff.import.new.title': 'New appointment',
  'handoff.import.changed.title': 'Updated appointment',
  'handoff.import.cancelled.title': 'Appointment cancelled',
  'handoff.import.upToDate.title': 'Already added',
  // Import screen — field labels
  'handoff.field.provider': 'From',
  'handoff.field.service': 'Service',
  'handoff.field.when': 'When',
  'handoff.field.duration': 'Duration',
  'handoff.field.address': 'Address',
  'handoff.import.previously': 'was {value}',
  // Import screen — actions + confirmations
  'handoff.import.add': 'Add appointment',
  'handoff.import.update': 'Update',
  'handoff.import.ok': 'OK',
  'handoff.import.done': 'Done',
  'handoff.import.added': 'Added',
  'handoff.import.updated': 'Updated',
  'handoff.import.removed': 'Cancelled',
  'handoff.import.writeFailed': "Couldn't save. Try again.",
  // Import screen — edge states
  'handoff.import.invalid.malformed': "This link isn't valid.",
  'handoff.import.invalid.version':
    'This link is from a newer version. Update the app to open it.',
  'handoff.import.empty': 'Nothing to import.',
} satisfies Strings;

const bg = {
  'handoff.share.link': 'Сподели връзка',
  'handoff.share.copy': 'Копирай връзка',
  'handoff.share.copied': 'Връзката е копирана',
  'handoff.share.copyFailed': 'Връзката не бе копирана',
  'handoff.share.setNameHint':
    'Въведете името си в Настройки, за да виждат клиентите от кого е часът.',
  'handoff.import.new.title': 'Нов час',
  'handoff.import.changed.title': 'Променен час',
  'handoff.import.cancelled.title': 'Отменен час',
  'handoff.import.upToDate.title': 'Вече е добавен',
  'handoff.field.provider': 'От',
  'handoff.field.service': 'Услуга',
  'handoff.field.when': 'Кога',
  'handoff.field.duration': 'Времетраене',
  'handoff.field.address': 'Адрес',
  'handoff.import.previously': 'беше {value}',
  'handoff.import.add': 'Добави часа',
  'handoff.import.update': 'Обнови',
  'handoff.import.ok': 'Добре',
  'handoff.import.done': 'Готово',
  'handoff.import.added': 'Добавен',
  'handoff.import.updated': 'Обновен',
  'handoff.import.removed': 'Отменен',
  'handoff.import.writeFailed': 'Неуспешен запис. Опитайте отново.',
  'handoff.import.invalid.malformed': 'Тази връзка е невалидна.',
  'handoff.import.invalid.version':
    'Тази връзка е от по-нова версия. Обновете приложението.',
  'handoff.import.empty': 'Няма какво да се внесе.',
} satisfies Strings;

export const handoffStrings = { en, bg };

declare module '../i18n' {
  interface TranslationKeys {
    'handoff.share.link': true;
    'handoff.share.copy': true;
    'handoff.share.copied': true;
    'handoff.share.copyFailed': true;
    'handoff.share.setNameHint': true;
    'handoff.import.new.title': true;
    'handoff.import.changed.title': true;
    'handoff.import.cancelled.title': true;
    'handoff.import.upToDate.title': true;
    'handoff.field.provider': true;
    'handoff.field.service': true;
    'handoff.field.when': true;
    'handoff.field.duration': true;
    'handoff.field.address': true;
    'handoff.import.previously': true;
    'handoff.import.add': true;
    'handoff.import.update': true;
    'handoff.import.ok': true;
    'handoff.import.done': true;
    'handoff.import.added': true;
    'handoff.import.updated': true;
    'handoff.import.removed': true;
    'handoff.import.writeFailed': true;
    'handoff.import.invalid.malformed': true;
    'handoff.import.invalid.version': true;
    'handoff.import.empty': true;
  }
}
```

- [ ] **Step 2: Write the parity test**

Create `src/modules/handoff/strings.test.ts` (mirror `booking/strings.test.ts`):
```ts
import { describe, expect, it } from 'vitest';
import { handoffStrings } from './strings';

describe('handoffStrings', () => {
  it('exposes identical keys for en and bg', () => {
    expect(Object.keys(handoffStrings.bg).sort()).toEqual(
      Object.keys(handoffStrings.en).sort(),
    );
  });

  it('has non-empty string values', () => {
    for (const bundle of [handoffStrings.en, handoffStrings.bg]) {
      for (const value of Object.values(bundle)) {
        expect(String(value).length).toBeGreaterThan(0);
      }
    }
  });
});
```

- [ ] **Step 3: Register the strings at the composition root**

In `src/app/main.tsx`, add the import and fold the bundle into both `registerStrings` calls:
```ts
import { handoffStrings } from '../modules/handoff';
// ...
  registerStrings('en', {
    ...shellStrings.en,
    ...scheduleStrings.en,
    ...bookingStrings.en,
    ...handoffStrings.en,
  });
  registerStrings('bg', {
    ...shellStrings.bg,
    ...scheduleStrings.bg,
    ...bookingStrings.bg,
    ...handoffStrings.bg,
  });
```
(Requires `handoffStrings` to be exported from `handoff/index.ts` — create the index now with just `export { handoffStrings } from './strings';` and the codec/classify re-exports from Tasks 2; the UI exports are appended in Tasks 4–5.)

Create `src/modules/handoff/index.ts`:
```ts
export {
  buildHandoffUrl,
  decodeHandoff,
  encodeHandoff,
} from './codec';
export type { DecodeResult, HandoffInput } from './codec';
export { classifyImport } from './classify';
export type { ImportOutcome } from './classify';
export { handoffStrings } from './strings';
```

- [ ] **Step 4: Run tests + typecheck (the app must still compile with the new keys)**

Run: `npx vitest run src/modules/handoff/strings.test.ts && npm run typecheck`
Expected: PASS + clean typecheck.

- [ ] **Step 5: Lint, format, commit**

```bash
npm run lint && npm run format:check
git add src/modules/handoff/strings.ts src/modules/handoff/strings.test.ts src/modules/handoff/index.ts src/app/main.tsx
git commit -m "feat: add handoff i18n strings + register them (#6)"
```

---

## Task 4: Provider share widget (QR + share/copy) wired into ShareLanding

**Files:**
- Modify: `package.json`, `package-lock.json` (add `qrcode.react`)
- Create: `src/modules/handoff/HandoffShare.tsx`
- Modify: `src/modules/handoff/index.ts` (export `HandoffShare`), `src/modules/booking/ShareLanding.tsx`
- Create: `e2e/handoff.spec.ts` (share-screen assertions)

**Interfaces:**
- Consumes: `buildHandoffUrl`, `HandoffInput` (Task 2); `Appointment` type (from `appointments`, via the appointment `ShareLanding` already holds); `getSettings`/`Settings` (from `settings`); `t` (i18n).
- Produces: `HandoffShare({ appointment, providerName, address }: { appointment: Appointment; providerName: string; address?: string })` — a React element rendering the QR + share/copy row and a hidden `data-testid="handoff-link"` element holding the URL.

- [ ] **Step 1: Install `qrcode.react`**

```bash
npm install qrcode.react
```
Confirm it lands in `dependencies` and `package-lock.json` updates.

- [ ] **Step 2: Implement `HandoffShare.tsx`**

Create `src/modules/handoff/HandoffShare.tsx`:
```tsx
import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { t } from '../i18n';
import { type Appointment } from '../appointments';
import { buildHandoffUrl } from './codec';

// Provider share widget. Renders a scannable QR of the handoff link plus a
// system-share / copy row. The QR sits on an explicit WHITE card with black
// modules (not themed to dark tokens) so it stays scannable in either theme.
export function HandoffShare({
  appointment,
  providerName,
  address,
}: {
  appointment: Appointment;
  providerName: string;
  address?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const url = buildHandoffUrl(
    {
      id: appointment.id,
      providerName,
      ...(address ? { address } : {}),
      service: appointment.service,
      start: appointment.start,
      durationMinutes: appointment.durationMinutes,
      status: appointment.status === 'cancelled' ? 'cancelled' : 'booked',
    },
    { origin: window.location.origin, basePath: import.meta.env.BASE_URL },
  );

  async function copy() {
    setCopied(false);
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopyFailed(true);
    }
  }

  async function share() {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ url });
        return;
      } catch {
        // user cancelled or share failed — fall through to copy
      }
    }
    await copy();
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="rounded-card bg-white p-3">
        <QRCodeSVG value={url} size={180} level="M" marginSize={0} />
      </div>
      {!providerName && (
        <p className="text-muted text-center text-[11.5px]">
          {t('handoff.share.setNameHint')}
        </p>
      )}
      <div className="flex w-full gap-2">
        <button
          type="button"
          onClick={() => void share()}
          className="bg-accent text-on-accent rounded-card flex-1 cursor-pointer border-0 p-3 text-center text-sm font-[650]"
        >
          {t('handoff.share.link')}
        </button>
        <button
          type="button"
          onClick={() => void copy()}
          className="bg-surface-2 text-ink border-line rounded-card flex-1 cursor-pointer border p-3 text-center text-sm font-semibold"
        >
          {copied ? t('handoff.share.copied') : t('handoff.share.copy')}
        </button>
      </div>
      {copyFailed && (
        <p className="text-danger text-center text-[11.5px]">
          {t('handoff.share.copyFailed')}
        </p>
      )}
      <span data-testid="handoff-link" className="sr-only">
        {url}
      </span>
    </div>
  );
}
```
Add to `src/modules/handoff/index.ts`:
```ts
export { HandoffShare } from './HandoffShare';
```

> If `sr-only` is not already a utility in the Tailwind v4 setup, use `className="absolute h-px w-px overflow-hidden"` instead — the element only needs to be in the DOM for the e2e to read, not visible.

- [ ] **Step 3: Wire it into `ShareLanding.tsx`**

In `src/modules/booking/ShareLanding.tsx`:
1. Add imports:
```ts
import { getSettings } from '../settings';
import { HandoffShare } from '../handoff';
```
2. Add a settings query (reuse the `['settings']` key the form uses) near the existing `record` query:
```ts
const { data: settings } = useQuery({
  queryKey: ['settings'],
  queryFn: getSettings,
});
```
3. Replace the disabled share `<button>` block (the one rendering `t('booking.landing.shareSoon')`, `disabled`) with:
```tsx
{appointment && (
  <HandoffShare
    appointment={appointment}
    providerName={settings?.providerName ?? ''}
    address={settings?.address}
  />
)}
```
The `booking.landing.shareSoon` string is now unused — leave it in `booking/strings.ts` (removing it is out of scope; a later cleanup can drop it) OR delete both en/bg entries and its `TranslationKeys` line if the parity test stays green. Prefer deleting to avoid dead strings.

- [ ] **Step 4: Write the share-screen e2e**

Create `e2e/handoff.spec.ts` with a booking helper (copy the `pickFutureDay`/`firstFreeSlot`/booking steps pattern from `e2e/provider-booking.spec.ts`, or import-free duplicate — keep it self-contained) and this test:
```ts
import { expect, type Page, test } from '@playwright/test';

const BASE = '/when-again/';

async function bookAndReachShare(page: Page): Promise<string> {
  await page.goto(BASE);
  await page.getByRole('link', { name: 'New', exact: true }).click();
  await page.getByRole('button', { name: 'Next month' }).click();
  await page.getByRole('button', { name: '15', exact: true }).click();
  await page.getByTestId('free-slot').first().click();
  await page.locator('#apptForm-client').fill('Client One');
  await page.locator('#apptForm-service').fill('Haircut');
  await page.locator('#apptForm-duration').fill('30');
  await page.getByRole('button', { name: 'Save · share' }).click();
  await expect(
    page.getByRole('heading', { name: 'Appointment saved' }),
  ).toBeVisible();
  const link = (await page.getByTestId('handoff-link').textContent())?.trim();
  if (!link) throw new Error('expected a handoff link on the share screen');
  return link;
}

test('the share screen renders a QR and a decodable handoff link', async ({
  page,
}) => {
  const link = await bookAndReachShare(page);
  // QR is an inline SVG inside the share widget.
  await expect(page.locator('svg').first()).toBeVisible();
  expect(link).toMatch(/\/when-again\/import#.+/);
});
```

- [ ] **Step 5: Build + run the share e2e**

Run: `npm run test:e2e -- handoff`
Expected: PASS (the new spec) and no regression in existing specs if run in full.

- [ ] **Step 6: Lint, format, typecheck, commit**

```bash
npm run typecheck && npm run lint && npm run format:check
git add package.json package-lock.json src/modules/handoff src/modules/booking/ShareLanding.tsx e2e/handoff.spec.ts
git commit -m "feat: provider share screen with QR + share link (#6)"
```

---

## Task 5: `/import` route + ImportScreen (decode → classify → write)

**Files:**
- Create: `src/app/routes/import.tsx`, `src/modules/handoff/ImportScreen.tsx`
- Modify: `src/modules/handoff/index.ts` (export `ImportScreen`)
- Modify: `e2e/handoff.spec.ts` (import state-matrix tests)

**Interfaces:**
- Consumes: `decodeHandoff`, `classifyImport` (Tasks 2); `getReceived`, `upsertReceived`, `ReceivedAppointment` (Task 1); `t`, `getActiveLanguage`, `formatDayLabel` (i18n/schedule — reuse the day-label formatter the landing uses); `useNavigate` (router); `useQuery`/`useQueryClient` (react-query).
- Produces: `ImportScreen()` React component; the `/import` route.

- [ ] **Step 1: Create the route file**

Create `src/app/routes/import.tsx`:
```tsx
import { createFileRoute } from '@tanstack/react-router';
import { ImportScreen } from '../../modules/handoff';

// The client-side import target. The payload rides in the URL FRAGMENT (never
// sent to the host); this route only needs to exist so GitHub Pages' SPA
// fallback boots the app here. ImportScreen reads `location.hash`.
export const Route = createFileRoute('/import')({
  component: ImportScreen,
});
```
Run `npm run dev` once (or `npx vite build`) so the plugin regenerates `src/app/routeTree.gen.ts` with the new route, and commit the regenerated tree with this task.

- [ ] **Step 2: Implement `ImportScreen.tsx`**

Create `src/modules/handoff/ImportScreen.tsx`:
```tsx
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getActiveLanguage, t } from '../i18n';
import { formatDayLabel } from '../schedule';
import {
  getReceived,
  upsertReceived,
  type ReceivedAppointment,
} from '../received';
import { decodeHandoff } from './codec';
import { classifyImport, type ImportOutcome } from './classify';

function CalmScreen({
  title,
  children,
  onDone,
  doneLabel,
}: {
  title: string;
  children?: React.ReactNode;
  onDone: () => void;
  doneLabel: string;
}) {
  return (
    <main className="grid min-h-[60vh] place-items-center px-[15px] py-6">
      <div className="flex w-full max-w-[360px] flex-col gap-3.5 text-center">
        <h1 className="font-serif text-[19px] font-[680] tracking-[-0.01em]">
          {title}
        </h1>
        {children}
        <button
          type="button"
          onClick={onDone}
          className="rounded-card bg-accent text-on-accent shadow-fab w-full cursor-pointer border-0 p-[13px] text-center text-[15px] font-[650]"
        >
          {doneLabel}
        </button>
      </div>
    </main>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="[&+&]:border-line [&+&]:border-t flex items-baseline justify-between gap-2.5 py-[9px]">
      <dt className="text-faint text-[10.5px] tracking-[0.05em] uppercase">
        {label}
      </dt>
      <dd className="text-ink m-0 text-right text-sm font-[550]">{value}</dd>
    </div>
  );
}

function Card({ appt }: { appt: ReceivedAppointment }) {
  const when = `${formatDayLabel(appt.start.dateTime.slice(0, 10), getActiveLanguage())} · ${appt.start.dateTime.slice(11, 16)}`;
  return (
    <dl className="border-line bg-surface-2 rounded-card border px-3.5 py-1 text-left">
      <SummaryRow label={t('handoff.field.provider')} value={appt.providerName} />
      <SummaryRow label={t('handoff.field.service')} value={appt.service} />
      <SummaryRow label={t('handoff.field.when')} value={when} />
      <SummaryRow
        label={t('handoff.field.duration')}
        value={`${appt.durationMinutes} ${t('booking.form.duration.suffix')}`}
      />
      {appt.address && (
        <SummaryRow label={t('handoff.field.address')} value={appt.address} />
      )}
    </dl>
  );
}

export function ImportScreen() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState<null | 'added' | 'updated' | 'removed'>(
    null,
  );
  const [writeError, setWriteError] = useState(false);

  const fragment =
    typeof window !== 'undefined' ? window.location.hash.slice(1) : '';
  const decoded = fragment ? decodeHandoff(fragment) : null;
  const incomingId = decoded?.ok ? decoded.appointment.id : undefined;

  const { data: stored } = useQuery({
    queryKey: ['received', incomingId],
    queryFn: () => getReceived(incomingId as string),
    enabled: incomingId != null,
  });

  const goHome = () => void navigate({ to: '/' });

  // --- edge states -------------------------------------------------------
  if (!fragment) {
    return (
      <CalmScreen
        title={t('handoff.import.empty')}
        onDone={goHome}
        doneLabel={t('handoff.import.done')}
      />
    );
  }
  if (!decoded || !decoded.ok) {
    const reason = decoded && !decoded.ok ? decoded.reason : 'malformed';
    return (
      <CalmScreen
        title={t(
          reason === 'unsupported-version'
            ? 'handoff.import.invalid.version'
            : 'handoff.import.invalid.malformed',
        )}
        onDone={goHome}
        doneLabel={t('handoff.import.done')}
      />
    );
  }

  const incoming = decoded.appointment;

  // --- post-write confirmation ------------------------------------------
  if (saved) {
    const title =
      saved === 'added'
        ? t('handoff.import.added')
        : saved === 'updated'
          ? t('handoff.import.updated')
          : t('handoff.import.removed');
    return (
      <CalmScreen
        title={title}
        onDone={goHome}
        doneLabel={t('handoff.import.done')}
      >
        <Card appt={incoming} />
      </CalmScreen>
    );
  }

  const outcome: ImportOutcome = classifyImport(incoming, stored ?? undefined);

  async function write(next: 'added' | 'updated' | 'removed') {
    setWriteError(false);
    try {
      await upsertReceived(incoming);
      await queryClient.invalidateQueries({ queryKey: ['received'] });
      setSaved(next);
    } catch {
      setWriteError(true);
    }
  }

  const errorNote = writeError ? (
    <p className="text-danger text-center text-[11.5px]">
      {t('handoff.import.writeFailed')}
    </p>
  ) : null;

  if (outcome.kind === 'upToDate') {
    return (
      <CalmScreen
        title={t('handoff.import.upToDate.title')}
        onDone={goHome}
        doneLabel={t('handoff.import.done')}
      >
        <Card appt={incoming} />
      </CalmScreen>
    );
  }

  // new / changed / cancelled all render a card + a primary action.
  const { title, action, next } =
    outcome.kind === 'new'
      ? {
          title: t('handoff.import.new.title'),
          action: t('handoff.import.add'),
          next: 'added' as const,
        }
      : outcome.kind === 'changed'
        ? {
            title: t('handoff.import.changed.title'),
            action: t('handoff.import.update'),
            next: 'updated' as const,
          }
        : {
            title: t('handoff.import.cancelled.title'),
            action: t('handoff.import.ok'),
            next: 'removed' as const,
          };

  return (
    <main className="grid min-h-[60vh] place-items-center px-[15px] py-6">
      <div className="flex w-full max-w-[360px] flex-col gap-3.5 text-center">
        <h1 className="font-serif text-[19px] font-[680] tracking-[-0.01em]">
          {title}
        </h1>
        <Card appt={incoming} />
        {outcome.kind === 'changed' && (
          <ChangedNote incoming={incoming} stored={outcome.stored} />
        )}
        {errorNote}
        <button
          type="button"
          onClick={() => void write(next)}
          className="rounded-card bg-accent text-on-accent shadow-fab w-full cursor-pointer border-0 p-[13px] text-center text-[15px] font-[650]"
        >
          {action}
        </button>
      </div>
    </main>
  );
}

// For a "changed" import, show the prior value of each field that moved.
function ChangedNote({
  incoming,
  stored,
}: {
  incoming: ReceivedAppointment;
  stored: ReceivedAppointment;
}) {
  const lines: string[] = [];
  if (
    incoming.start.dateTime !== stored.start.dateTime ||
    incoming.start.timeZone !== stored.start.timeZone
  ) {
    lines.push(
      t('handoff.import.previously', {
        value: `${formatDayLabel(stored.start.dateTime.slice(0, 10), getActiveLanguage())} · ${stored.start.dateTime.slice(11, 16)}`,
      }),
    );
  }
  if (incoming.service !== stored.service) {
    lines.push(t('handoff.import.previously', { value: stored.service }));
  }
  if (incoming.durationMinutes !== stored.durationMinutes) {
    lines.push(
      t('handoff.import.previously', {
        value: `${stored.durationMinutes} ${t('booking.form.duration.suffix')}`,
      }),
    );
  }
  if (lines.length === 0) return null;
  return (
    <p className="text-muted text-center text-[11.5px]">{lines.join(' · ')}</p>
  );
}
```
Add to `src/modules/handoff/index.ts`:
```ts
export { ImportScreen } from './ImportScreen';
```

> `handoff` now imports `schedule` (for `formatDayLabel`) and `booking.form.duration.suffix` (an i18n key registered by `booking`). Importing another module's *registered string key* via `t()` is not a code import — it is a runtime key lookup — so it does not create a module edge. The only code edges `handoff` adds are `schedule` (formatter) and `received`; still no `booking` import. Confirm `formatDayLabel` is exported from `schedule/index.ts`; it is (the landing uses it).

- [ ] **Step 3: Add the import state-matrix e2e**

Append to `e2e/handoff.spec.ts`:
```ts
test('import: empty and invalid links show calm states', async ({ page }) => {
  await page.goto(`${BASE}import`);
  await expect(page.getByText('Nothing to import.')).toBeVisible();

  await page.goto(`${BASE}import#not-valid-base64!!`);
  await expect(page.getByText("This link isn't valid.")).toBeVisible();
});

test('import: new → add → re-open shows up to date (idempotent)', async ({
  page,
}) => {
  const link = await bookAndReachShare(page);

  await page.goto(link);
  await expect(
    page.getByRole('heading', { name: 'New appointment' }),
  ).toBeVisible();
  await expect(page.getByText('Haircut')).toBeVisible();
  await page.getByRole('button', { name: 'Add appointment' }).click();
  await expect(page.getByRole('heading', { name: 'Added' })).toBeVisible();

  // Re-opening the same link is idempotent.
  await page.goto(link);
  await expect(
    page.getByRole('heading', { name: 'Already added' }),
  ).toBeVisible();
});
```

- [ ] **Step 4: Build + run the import e2e**

Run: `npm run test:e2e -- handoff`
Expected: PASS.

- [ ] **Step 5: Lint, format, typecheck, commit**

```bash
npm run typecheck && npm run lint && npm run format:check
git add src/app/routes/import.tsx src/app/routeTree.gen.ts src/modules/handoff/ImportScreen.tsx src/modules/handoff/index.ts e2e/handoff.spec.ts
git commit -m "feat: client import route + screen (new/changed/cancelled) (#6)"
```

---

## Task 6: End-to-end round-trip acceptance test

**Files:**
- Modify: `e2e/handoff.spec.ts`

**Interfaces:**
- Consumes: everything above (provider share + client import). No new production code — this task is the epic's Done-criteria gate and fixes any integration gap it exposes.

- [ ] **Step 1: Write the round-trip test**

Append to `e2e/handoff.spec.ts`. It books, imports (new), reschedules and re-shares (changed), then cancels and re-shares (cancelled), asserting a single received record throughout. Reschedule/cancel reuse the provider edit flow (tap the appointment block → Change / Cancel), mirroring `e2e/provider-booking.spec.ts`:
```ts
test('round-trip: book → import → reschedule → cancel, no duplicates', async ({
  page,
}) => {
  // 1. Book and import as new.
  const firstLink = await bookAndReachShare(page);
  await page.goto(firstLink);
  await page.getByRole('button', { name: 'Add appointment' }).click();
  await expect(page.getByRole('heading', { name: 'Added' })).toBeVisible();

  // 2. Provider reschedules the appointment, then re-shares.
  await page.goto(BASE);
  await page.getByTestId('appt-block').first().click();
  await expect(
    page.getByRole('heading', { name: 'Edit appointment' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Change', exact: true }).click();
  await page.getByTestId('free-slot').first().click();
  await page.getByRole('button', { name: 'Save · share' }).click();
  await expect(
    page.getByRole('heading', { name: 'Appointment saved' }),
  ).toBeVisible();
  const changedLink = (
    await page.getByTestId('handoff-link').textContent()
  )?.trim();
  if (!changedLink) throw new Error('expected a handoff link after reschedule');
  expect(changedLink).not.toBe(firstLink); // the time changed → payload changed

  // 3. Client imports the change.
  await page.goto(changedLink);
  await expect(
    page.getByRole('heading', { name: 'Updated appointment' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Update' }).click();
  await expect(page.getByRole('heading', { name: 'Updated' })).toBeVisible();

  // 4. Provider cancels, then re-shares.
  await page.goto(BASE);
  await page.getByTestId('appt-block').first().click();
  await page.getByRole('button', { name: 'Cancel appointment' }).click();
  await expect(
    page.getByRole('heading', { name: 'Appointment cancelled' }),
  ).toBeVisible();
  const cancelledLink = (
    await page.getByTestId('handoff-link').textContent()
  )?.trim();
  if (!cancelledLink) throw new Error('expected a handoff link after cancel');

  // 5. Client imports the cancellation.
  await page.goto(cancelledLink);
  await expect(
    page.getByRole('heading', { name: 'Appointment cancelled' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'OK' }).click();
  await expect(page.getByRole('heading', { name: 'Cancelled' })).toBeVisible();

  // 6. No duplicates: exactly one received record, now cancelled.
  const count = await page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const req = indexedDB.open('when-again');
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('received', 'readonly');
          const all = tx.objectStore('received').getAll();
          all.onsuccess = () => {
            resolve(all.result.length);
            db.close();
          };
          all.onerror = () => reject(all.error);
        };
        req.onerror = () => reject(req.error);
      }),
  );
  expect(count).toBe(1);
});
```

> Note on the cancelled share link: `ShareLanding` renders `<HandoffShare>` whenever `appointment` is present, and after a cancel the `['appointment', id]` record has `status: 'cancelled'`, so the widget encodes `c:1`. Confirm the cancelled landing still mounts `HandoffShare` (it should — the guard is `appointment != null`, not status-based). If the cancelled landing intentionally hides sharing, adjust Task 4's guard so a cancellation can be shared; the whole point of the cancelled state is to re-share it.

- [ ] **Step 2: Run the full e2e suite**

Run: `npm run test:e2e`
Expected: PASS — the new round-trip plus all existing specs.

- [ ] **Step 3: Run the full unit suite + gates**

Run: `npx vitest run && npm run typecheck && npm run lint && npm run format:check`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add e2e/handoff.spec.ts
git commit -m "test: end-to-end handoff round-trip acceptance (#6)"
```

---

## Self-Review

**Spec coverage:**
- §1 scope (mechanism + import confirmation; no client home / no .ics) → Tasks 1–6 stay within it; "Done" returns to `/` (Task 5). ✓
- §2 architecture (`received` low, `handoff` high, `booking → handoff`, no `booking` import) → Task 1 (`received`), Tasks 2–5 (`handoff`), Task 4 wiring. ✓
- §3 data model + DB migration → Task 1. ✓
- §4 payload/link/codec → Task 2. ✓
- §5 provider share screen (QR/share/copy, white QR card, no-name hint) → Task 4. ✓
- §6 import flow (four states + idempotency) → Tasks 5–6. ✓
- §7 wall-clock literal → codec passes `dateTime`/`timeZone` through unchanged (Task 2); import displays the literal time (Task 5). ✓
- §8 error handling (invalid/empty/write-fail/share-fail) → Tasks 4–5. ✓
- §9 i18n → Task 3. ✓
- §10 dependency (`qrcode.react`) → Task 4. ✓
- §11 testing (codec, received CRUD, classify, e2e round-trip) → Tasks 1, 2, 5, 6. ✓
- §12 deferrals (UUID compaction, byDateTime index) → not built (correct). ✓

**Type consistency:** `ReceivedAppointment` (Task 1) is the shape `decodeHandoff` returns and `classifyImport`/`ImportScreen`/`HandoffShare` consume. `HandoffInput` (Task 2) is what `HandoffShare` builds and `buildHandoffUrl` takes. `ImportOutcome.kind ∈ {new, changed, cancelled, upToDate}` is consistent across `classify.ts` and `ImportScreen`. `STORE_RECEIVED = 'received'` matches the e2e's `objectStore('received')`.

**Placeholder scan:** every code step carries full code; no TBD/"handle errors"/"similar to". The one conditional instruction (delete-vs-keep `booking.landing.shareSoon`) has a concrete recommended action (delete both entries + its key line, keep parity green).

**Known coupling introduced (intended):** `handoff` imports `schedule` (`formatDayLabel`) and `booking` imports `handoff` — both acyclic; `handoff` never imports `booking`. Verify in the final review with a grep: `grep -rn "modules/booking" src/modules/handoff` returns nothing.
