# Epic 3: Local Data Layer & Backup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The entity modules (`time`, `db`, `settings`, `clients`, `appointments`) plus the `backup` module — data survives restarts, an export→wipe→import cycle loses nothing, and staleness detection works. No UI in this epic; the modules are consumed by later epics.

**Architecture:** Modulith per the spec's Code structure section. `db` is a leaf that owns the IndexedDB connection and schema (store names + indexes, no entity types). Entity modules (`settings`, `clients`, `appointments`) own their types and typed queries on top of `db`. `time` is a pure leaf module (wall-clock semantics). `backup` composes the entity modules for export/import/staleness. All cross-module imports go through `index.ts` public APIs. Unit tests run on Vitest with `fake-indexeddb`.

**Tech Stack:** idb (runtime dep), fake-indexeddb (dev dep), Vitest.

## Global Constraints

- Package manager: **npm**. New runtime dependency allowed: `idb`. New dev dependency allowed: `fake-indexeddb`. No other dependency changes; TypeScript stays `~6.0.3`.
- TypeScript strict; no server code, no analytics, no external network calls.
- Modulith rules: cross-module imports only via `modules/<name>/index.ts`; no dependency cycles; nothing imports `src/app/`. Allowed dependency directions in this epic: `settings|clients|appointments → db`, `appointments → time`, `clients → appointments` (visit history), `backup → settings|clients|appointments`.
- TDD for every module: write the failing test first, watch it fail, implement, watch it pass.
- Keep green before every commit: `npm run lint`, `npm run format:check` (run `npm run format` when needed), `npm run typecheck`, `npm test -- --run`.
- Working branch: create `epic-3-data-layer` off up-to-date `main`; do NOT push to `main` directly.
- Commit messages: plain conventional style, no Claude session links.
- Time semantics from the spec: appointments store **local wall-clock time plus the IANA timezone name** ("15:00 means 15:00 at the provider's location"). Never store epoch/UTC for appointment starts.

---

### Task 1: Branch + dependencies + `time` module (TDD)

**Files:**

- Create: `src/modules/time/wallClock.ts`, `src/modules/time/index.ts`
- Test: `src/modules/time/wallClock.test.ts`
- Modify: `package.json` (deps)

**Interfaces:**

- Consumes: nothing.
- Produces (public API of `time`): `interface WallClock { dateTime: string; timeZone: string }` (dateTime is `'YYYY-MM-DDTHH:mm'` local wall-clock, timeZone is an IANA name), `wallClockNow(now?: Date, timeZone?: string): WallClock`, `compareWallClock(a: WallClock, b: WallClock): number`, `isBefore(a: WallClock, b: WallClock): boolean`.

- [ ] **Step 1: Branch and dependencies**

```bash
cd ~/Projects/when-again && git checkout main && git pull && git checkout -b epic-3-data-layer
npm install idb
npm install -D fake-indexeddb
```

- [ ] **Step 2: Write the failing test**

`src/modules/time/wallClock.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { compareWallClock, isBefore, wallClockNow } from './wallClock';

describe('wallClockNow', () => {
  it('formats a Date as local wall-clock YYYY-MM-DDTHH:mm', () => {
    const d = new Date(2026, 7, 21, 14, 5); // 2026-08-21 14:05 local
    expect(wallClockNow(d, 'Europe/Sofia')).toEqual({
      dateTime: '2026-08-21T14:05',
      timeZone: 'Europe/Sofia',
    });
  });

  it('defaults the timezone to the device timezone', () => {
    const wc = wallClockNow(new Date(2026, 0, 2, 3, 4));
    expect(wc.timeZone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
    expect(wc.dateTime).toBe('2026-01-02T03:04');
  });
});

describe('compareWallClock / isBefore', () => {
  const a = { dateTime: '2026-08-21T14:00', timeZone: 'Europe/Sofia' };
  const b = { dateTime: '2026-08-21T15:30', timeZone: 'Europe/Sofia' };

  it('orders by wall-clock datetime', () => {
    expect(compareWallClock(a, b)).toBeLessThan(0);
    expect(compareWallClock(b, a)).toBeGreaterThan(0);
    expect(compareWallClock(a, { ...a })).toBe(0);
  });

  it('isBefore mirrors the comparison', () => {
    expect(isBefore(a, b)).toBe(true);
    expect(isBefore(b, a)).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- --run`
Expected: FAIL — cannot resolve `./wallClock`.

- [ ] **Step 4: Write the implementation**

`src/modules/time/wallClock.ts`:

```ts
export interface WallClock {
  /** Local wall-clock time, 'YYYY-MM-DDTHH:mm'. 15:00 means 15:00 at the provider's location. */
  dateTime: string;
  /** IANA timezone name, e.g. 'Europe/Sofia'. */
  timeZone: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function wallClockNow(
  now: Date = new Date(),
  timeZone: string = Intl.DateTimeFormat().resolvedOptions().timeZone,
): WallClock {
  const dateTime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return { dateTime, timeZone };
}

export function compareWallClock(a: WallClock, b: WallClock): number {
  return a.dateTime < b.dateTime ? -1 : a.dateTime > b.dateTime ? 1 : 0;
}

export function isBefore(a: WallClock, b: WallClock): boolean {
  return compareWallClock(a, b) < 0;
}
```

`src/modules/time/index.ts`:

```ts
export { compareWallClock, isBefore, wallClockNow } from './wallClock';
export type { WallClock } from './wallClock';
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- --run` — expected: all passing.

- [ ] **Step 6: Verify checks and commit**

```bash
npm run format && npm run lint && npm run typecheck
git add -A && git commit -m "feat: add time module with wall-clock semantics"
```

---

### Task 2: `db` module (TDD with fake-indexeddb)

**Files:**

- Create: `src/modules/db/db.ts`, `src/modules/db/index.ts`
- Test: `src/modules/db/db.test.ts`

**Interfaces:**

- Consumes: `idb`, `fake-indexeddb` (tests only).
- Produces (public API of `db`): constants `DB_NAME = 'when-again'`, `STORE_CLIENTS = 'clients'`, `STORE_APPOINTMENTS = 'appointments'`, `STORE_SETTINGS = 'settings'`, `INDEX_APPOINTMENTS_BY_CLIENT = 'byClientId'`, `INDEX_APPOINTMENTS_BY_DATETIME = 'byDateTime'`; `getDb(): Promise<IDBPDatabase>` (memoized, creates schema v1 on upgrade); `closeDb(): void`; `destroyDb(): Promise<void>` (close + delete — used by tests); `requestPersistentStorage(): Promise<boolean>`.
- `db` knows store NAMES and index paths only — no entity types (keeps it a leaf).

- [ ] **Step 1: Write the failing test**

`src/modules/db/db.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DB_NAME,
  destroyDb,
  getDb,
  INDEX_APPOINTMENTS_BY_CLIENT,
  INDEX_APPOINTMENTS_BY_DATETIME,
  requestPersistentStorage,
  STORE_APPOINTMENTS,
  STORE_CLIENTS,
  STORE_SETTINGS,
} from './db';

afterEach(async () => {
  await destroyDb();
});

describe('getDb', () => {
  it('creates the three object stores', async () => {
    const db = await getDb();
    expect(db.name).toBe(DB_NAME);
    expect([...db.objectStoreNames].sort()).toEqual(
      [STORE_APPOINTMENTS, STORE_CLIENTS, STORE_SETTINGS].sort(),
    );
  });

  it('creates the appointment indexes', async () => {
    const db = await getDb();
    const tx = db.transaction(STORE_APPOINTMENTS);
    const names = [...tx.store.indexNames];
    expect(names).toContain(INDEX_APPOINTMENTS_BY_CLIENT);
    expect(names).toContain(INDEX_APPOINTMENTS_BY_DATETIME);
  });

  it('memoizes the connection', async () => {
    expect(await getDb()).toBe(await getDb());
  });

  it('persists data across close and reopen', async () => {
    const db = await getDb();
    await db.put(STORE_CLIENTS, { id: 'c1', name: 'Maria' });
    db.close();
    const reopened = await getDb();
    expect(await reopened.get(STORE_CLIENTS, 'c1')).toEqual({
      id: 'c1',
      name: 'Maria',
    });
  });
});

describe('requestPersistentStorage', () => {
  it('returns false when the API is unavailable', async () => {
    expect(await requestPersistentStorage()).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run` — expected: FAIL, cannot resolve `./db`.

- [ ] **Step 3: Write the implementation**

`src/modules/db/db.ts`:

```ts
import { openDB, type IDBPDatabase } from 'idb';

export const DB_NAME = 'when-again';
export const STORE_CLIENTS = 'clients';
export const STORE_APPOINTMENTS = 'appointments';
export const STORE_SETTINGS = 'settings';
export const INDEX_APPOINTMENTS_BY_CLIENT = 'byClientId';
export const INDEX_APPOINTMENTS_BY_DATETIME = 'byDateTime';

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getDb(): Promise<IDBPDatabase> {
  dbPromise ??= openDB(DB_NAME, 1, {
    upgrade(db) {
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
    },
    terminated() {
      dbPromise = null;
    },
  }).then((db) => {
    db.addEventListener('close', () => {
      dbPromise = null;
    });
    return db;
  });
  return dbPromise;
}

export function closeDb(): void {
  void dbPromise?.then((db) => db.close());
  dbPromise = null;
}

/** Close and delete the database. Test helper — never called by app code. */
export async function destroyDb(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
    dbPromise = null;
  }
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error('deleteDatabase failed'));
    req.onblocked = () => resolve();
  });
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist)
    return false;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
```

`src/modules/db/index.ts`:

```ts
export {
  closeDb,
  DB_NAME,
  destroyDb,
  getDb,
  INDEX_APPOINTMENTS_BY_CLIENT,
  INDEX_APPOINTMENTS_BY_DATETIME,
  requestPersistentStorage,
  STORE_APPOINTMENTS,
  STORE_CLIENTS,
  STORE_SETTINGS,
} from './db';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run` — expected: all passing. If the `persists data across close and reopen` test flakes on the close event, memoization reset via the `close` listener is the part to check — do not delete the test.

- [ ] **Step 5: Verify checks and commit**

```bash
npm run format && npm run lint && npm run typecheck
git add -A && git commit -m "feat: add db module with IndexedDB schema v1"
```

---

### Task 3: `settings` module (TDD)

**Files:**

- Create: `src/modules/settings/settings.ts`, `src/modules/settings/index.ts`
- Test: `src/modules/settings/settings.test.ts`

**Interfaces:**

- Consumes: `db` (`getDb`, `STORE_SETTINGS`, `destroyDb` in tests).
- Produces (public API of `settings`): `interface ServicePreset { name: string; durationMinutes: number; price?: number }`, `type Language = 'bg' | 'en'`, `type Mode = 'provider' | 'client'`, `interface Settings { providerName: string; address?: string; services: ServicePreset[]; language: Language | null; mode: Mode | null; lastBackupAt: string | null }`, `DEFAULT_SETTINGS: Settings`, `getSettings(): Promise<Settings>`, `updateSettings(patch: Partial<Settings>): Promise<Settings>`, `replaceSettings(settings: Settings): Promise<void>` (backup import uses it).

- [ ] **Step 1: Write the failing test**

`src/modules/settings/settings.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { destroyDb } from '../db';
import {
  DEFAULT_SETTINGS,
  getSettings,
  replaceSettings,
  updateSettings,
} from './settings';

afterEach(async () => {
  await destroyDb();
});

describe('settings', () => {
  it('returns defaults when nothing is stored', async () => {
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('updates a subset and persists it', async () => {
    const updated = await updateSettings({
      providerName: 'Salon Maria',
      language: 'bg',
    });
    expect(updated.providerName).toBe('Salon Maria');
    expect(updated.language).toBe('bg');
    expect(await getSettings()).toEqual(updated);
  });

  it('merges patches without dropping earlier fields', async () => {
    await updateSettings({ providerName: 'Salon Maria' });
    await updateSettings({ mode: 'provider' });
    const s = await getSettings();
    expect(s.providerName).toBe('Salon Maria');
    expect(s.mode).toBe('provider');
  });

  it('replaceSettings overwrites everything', async () => {
    await updateSettings({ providerName: 'Old' });
    const next = {
      ...DEFAULT_SETTINGS,
      providerName: 'New',
      services: [{ name: 'Haircut', durationMinutes: 45 }],
    };
    await replaceSettings(next);
    expect(await getSettings()).toEqual(next);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run` — expected: FAIL, cannot resolve `./settings`.

- [ ] **Step 3: Write the implementation**

`src/modules/settings/settings.ts`:

```ts
import { getDb, STORE_SETTINGS } from '../db';

export interface ServicePreset {
  name: string;
  durationMinutes: number;
  price?: number;
}

export type Language = 'bg' | 'en';
export type Mode = 'provider' | 'client';

export interface Settings {
  providerName: string;
  address?: string;
  services: ServicePreset[];
  language: Language | null;
  mode: Mode | null;
  /** ISO timestamp of the last backup export, null if never backed up. */
  lastBackupAt: string | null;
}

export const DEFAULT_SETTINGS: Settings = {
  providerName: '',
  services: [],
  language: null,
  mode: null,
  lastBackupAt: null,
};

const SINGLETON_ID = 'singleton';

type StoredSettings = Settings & { id: typeof SINGLETON_ID };

export async function getSettings(): Promise<Settings> {
  const db = await getDb();
  const stored = (await db.get(STORE_SETTINGS, SINGLETON_ID)) as
    StoredSettings | undefined;
  if (!stored) return { ...DEFAULT_SETTINGS };
  const { id: _id, ...settings } = stored;
  return { ...DEFAULT_SETTINGS, ...settings };
}

export async function updateSettings(
  patch: Partial<Settings>,
): Promise<Settings> {
  const current = await getSettings();
  const next = { ...current, ...patch };
  await replaceSettings(next);
  return next;
}

export async function replaceSettings(settings: Settings): Promise<void> {
  const db = await getDb();
  await db.put(STORE_SETTINGS, {
    id: SINGLETON_ID,
    ...settings,
  } satisfies StoredSettings);
}
```

`src/modules/settings/index.ts`:

```ts
export {
  DEFAULT_SETTINGS,
  getSettings,
  replaceSettings,
  updateSettings,
} from './settings';
export type { Language, Mode, ServicePreset, Settings } from './settings';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run` — expected: all passing.

- [ ] **Step 5: Verify checks and commit**

```bash
npm run format && npm run lint && npm run typecheck
git add -A && git commit -m "feat: add settings module with singleton store"
```

---

### Task 4: `appointments` module (TDD)

**Files:**

- Create: `src/modules/appointments/appointments.ts`, `src/modules/appointments/index.ts`
- Test: `src/modules/appointments/appointments.test.ts`

**Interfaces:**

- Consumes: `db` (`getDb`, `STORE_APPOINTMENTS`, both index constants, `destroyDb` in tests), `time` (`WallClock`).
- Produces (public API of `appointments`): `type AppointmentStatus = 'booked' | 'done' | 'cancelled'`, `interface Appointment { id: string; clientId: string; start: WallClock; durationMinutes: number; service: string; price?: number; status: AppointmentStatus }`, `addAppointment(data: Omit<Appointment, 'id'>): Promise<Appointment>` (id = `crypto.randomUUID()`), `updateAppointment(appointment: Appointment): Promise<void>`, `getAppointment(id: string): Promise<Appointment | undefined>`, `listAppointmentsOnDate(date: string): Promise<Appointment[]>` (date `'YYYY-MM-DD'`, sorted by start ascending), `listAppointmentsByClient(clientId: string): Promise<Appointment[]>` (sorted by start ascending), `listAllAppointments(): Promise<Appointment[]>`, `replaceAllAppointments(items: Appointment[]): Promise<void>` (wipe + bulk put; backup import uses it).

- [ ] **Step 1: Write the failing test**

`src/modules/appointments/appointments.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { destroyDb } from '../db';
import {
  addAppointment,
  getAppointment,
  listAllAppointments,
  listAppointmentsByClient,
  listAppointmentsOnDate,
  replaceAllAppointments,
  updateAppointment,
  type Appointment,
} from './appointments';

afterEach(async () => {
  await destroyDb();
});

const base = {
  clientId: 'c1',
  durationMinutes: 45,
  service: 'Haircut',
  status: 'booked' as const,
};

const at = (dateTime: string) => ({ dateTime, timeZone: 'Europe/Sofia' });

describe('appointments', () => {
  it('adds with a generated id and reads back', async () => {
    const a = await addAppointment({ ...base, start: at('2026-08-21T14:00') });
    expect(a.id).toMatch(/[0-9a-f-]{36}/);
    expect(await getAppointment(a.id)).toEqual(a);
  });

  it('updates in place by id', async () => {
    const a = await addAppointment({ ...base, start: at('2026-08-21T14:00') });
    await updateAppointment({ ...a, status: 'cancelled' });
    expect((await getAppointment(a.id))?.status).toBe('cancelled');
  });

  it('lists a day sorted by start time, excluding other days', async () => {
    await addAppointment({ ...base, start: at('2026-08-21T15:00') });
    await addAppointment({ ...base, start: at('2026-08-21T09:30') });
    await addAppointment({ ...base, start: at('2026-08-22T10:00') });
    const day = await listAppointmentsOnDate('2026-08-21');
    expect(day.map((a) => a.start.dateTime)).toEqual([
      '2026-08-21T09:30',
      '2026-08-21T15:00',
    ]);
  });

  it('lists by client sorted by start time', async () => {
    await addAppointment({ ...base, start: at('2026-09-01T10:00') });
    await addAppointment({
      ...base,
      clientId: 'c2',
      start: at('2026-09-01T11:00'),
    });
    await addAppointment({ ...base, start: at('2026-08-01T10:00') });
    const forC1 = await listAppointmentsByClient('c1');
    expect(forC1.map((a) => a.start.dateTime)).toEqual([
      '2026-08-01T10:00',
      '2026-09-01T10:00',
    ]);
  });

  it('replaceAllAppointments wipes and restores', async () => {
    await addAppointment({ ...base, start: at('2026-08-21T14:00') });
    const restored: Appointment[] = [
      { ...base, id: 'x1', start: at('2027-01-01T08:00') },
    ];
    await replaceAllAppointments(restored);
    expect(await listAllAppointments()).toEqual(restored);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run` — expected: FAIL, cannot resolve `./appointments`.

- [ ] **Step 3: Write the implementation**

`src/modules/appointments/appointments.ts`:

```ts
import {
  getDb,
  INDEX_APPOINTMENTS_BY_CLIENT,
  INDEX_APPOINTMENTS_BY_DATETIME,
  STORE_APPOINTMENTS,
} from '../db';
import { type WallClock } from '../time';

export type AppointmentStatus = 'booked' | 'done' | 'cancelled';

export interface Appointment {
  id: string;
  clientId: string;
  start: WallClock;
  durationMinutes: number;
  service: string;
  price?: number;
  status: AppointmentStatus;
}

export async function addAppointment(
  data: Omit<Appointment, 'id'>,
): Promise<Appointment> {
  const appointment: Appointment = { id: crypto.randomUUID(), ...data };
  const db = await getDb();
  await db.add(STORE_APPOINTMENTS, appointment);
  return appointment;
}

export async function updateAppointment(
  appointment: Appointment,
): Promise<void> {
  const db = await getDb();
  await db.put(STORE_APPOINTMENTS, appointment);
}

export async function getAppointment(
  id: string,
): Promise<Appointment | undefined> {
  const db = await getDb();
  return (await db.get(STORE_APPOINTMENTS, id)) as Appointment | undefined;
}

const byStart = (a: Appointment, b: Appointment) =>
  a.start.dateTime < b.start.dateTime
    ? -1
    : a.start.dateTime > b.start.dateTime
      ? 1
      : 0;

export async function listAppointmentsOnDate(
  date: string,
): Promise<Appointment[]> {
  const db = await getDb();
  const range = IDBKeyRange.bound(`${date}T00:00`, `${date}T23:59`);
  const items = (await db.getAllFromIndex(
    STORE_APPOINTMENTS,
    INDEX_APPOINTMENTS_BY_DATETIME,
    range,
  )) as Appointment[];
  return items.sort(byStart);
}

export async function listAppointmentsByClient(
  clientId: string,
): Promise<Appointment[]> {
  const db = await getDb();
  const items = (await db.getAllFromIndex(
    STORE_APPOINTMENTS,
    INDEX_APPOINTMENTS_BY_CLIENT,
    clientId,
  )) as Appointment[];
  return items.sort(byStart);
}

export async function listAllAppointments(): Promise<Appointment[]> {
  const db = await getDb();
  return (await db.getAll(STORE_APPOINTMENTS)) as Appointment[];
}

export async function replaceAllAppointments(
  items: Appointment[],
): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(STORE_APPOINTMENTS, 'readwrite');
  await tx.store.clear();
  for (const item of items) await tx.store.put(item);
  await tx.done;
}
```

`src/modules/appointments/index.ts`:

```ts
export {
  addAppointment,
  getAppointment,
  listAllAppointments,
  listAppointmentsByClient,
  listAppointmentsOnDate,
  replaceAllAppointments,
  updateAppointment,
} from './appointments';
export type { Appointment, AppointmentStatus } from './appointments';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run` — expected: all passing.

- [ ] **Step 5: Verify checks and commit**

```bash
npm run format && npm run lint && npm run typecheck
git add -A && git commit -m "feat: add appointments module with day and client queries"
```

---

### Task 5: `clients` module with visit history (TDD)

**Files:**

- Create: `src/modules/clients/clients.ts`, `src/modules/clients/index.ts`
- Test: `src/modules/clients/clients.test.ts`

**Interfaces:**

- Consumes: `db` (`getDb`, `STORE_CLIENTS`, `destroyDb` in tests), `appointments` (`listAppointmentsByClient`, `addAppointment` in tests, `Appointment` type), `time` (`WallClock`, `wallClockNow`).
- Produces (public API of `clients`): `interface Client { id: string; name: string; phone?: string; notes?: string }`, `addClient(data: Omit<Client, 'id'>): Promise<Client>`, `updateClient(client: Client): Promise<void>`, `getClient(id: string): Promise<Client | undefined>`, `listClients(): Promise<Client[]>` (sorted by name, `localeCompare`), `replaceAllClients(clients: Client[]): Promise<void>`, `getVisitHistory(clientId: string, now?: WallClock): Promise<Appointment[]>` — past (start before now), non-cancelled appointments, **newest first**.

- [ ] **Step 1: Write the failing test**

`src/modules/clients/clients.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { addAppointment } from '../appointments';
import { destroyDb } from '../db';
import {
  addClient,
  getClient,
  getVisitHistory,
  listClients,
  replaceAllClients,
  updateClient,
} from './clients';

afterEach(async () => {
  await destroyDb();
});

describe('clients', () => {
  it('adds with a generated id and reads back', async () => {
    const c = await addClient({ name: 'Maria', phone: '+359888123456' });
    expect(c.id).toMatch(/[0-9a-f-]{36}/);
    expect(await getClient(c.id)).toEqual(c);
  });

  it('updates in place', async () => {
    const c = await addClient({ name: 'Maria' });
    await updateClient({ ...c, notes: 'prefers mornings' });
    expect((await getClient(c.id))?.notes).toBe('prefers mornings');
  });

  it('lists sorted by name', async () => {
    await addClient({ name: 'Zara' });
    await addClient({ name: 'Anna' });
    expect((await listClients()).map((c) => c.name)).toEqual(['Anna', 'Zara']);
  });

  it('replaceAllClients wipes and restores', async () => {
    await addClient({ name: 'Old' });
    await replaceAllClients([{ id: 'x1', name: 'Restored' }]);
    expect((await listClients()).map((c) => c.name)).toEqual(['Restored']);
  });
});

describe('getVisitHistory', () => {
  const at = (dateTime: string) => ({ dateTime, timeZone: 'Europe/Sofia' });
  const now = at('2026-08-21T12:00');
  const base = {
    durationMinutes: 45,
    service: 'Haircut',
    status: 'booked' as const,
  };

  it('returns past non-cancelled visits, newest first', async () => {
    const c = await addClient({ name: 'Maria' });
    await addAppointment({
      ...base,
      clientId: c.id,
      start: at('2026-05-10T10:00'),
    });
    await addAppointment({
      ...base,
      clientId: c.id,
      start: at('2026-07-01T10:00'),
    });
    await addAppointment({
      ...base,
      clientId: c.id,
      start: at('2026-06-01T10:00'),
      status: 'cancelled',
    });
    await addAppointment({
      ...base,
      clientId: c.id,
      start: at('2026-09-01T10:00'),
    }); // future
    const history = await getVisitHistory(c.id, now);
    expect(history.map((a) => a.start.dateTime)).toEqual([
      '2026-07-01T10:00',
      '2026-05-10T10:00',
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run` — expected: FAIL, cannot resolve `./clients`.

- [ ] **Step 3: Write the implementation**

`src/modules/clients/clients.ts`:

```ts
import { listAppointmentsByClient, type Appointment } from '../appointments';
import { getDb, STORE_CLIENTS } from '../db';
import { isBefore, wallClockNow, type WallClock } from '../time';

export interface Client {
  id: string;
  name: string;
  phone?: string;
  notes?: string;
}

export async function addClient(data: Omit<Client, 'id'>): Promise<Client> {
  const client: Client = { id: crypto.randomUUID(), ...data };
  const db = await getDb();
  await db.add(STORE_CLIENTS, client);
  return client;
}

export async function updateClient(client: Client): Promise<void> {
  const db = await getDb();
  await db.put(STORE_CLIENTS, client);
}

export async function getClient(id: string): Promise<Client | undefined> {
  const db = await getDb();
  return (await db.get(STORE_CLIENTS, id)) as Client | undefined;
}

export async function listClients(): Promise<Client[]> {
  const db = await getDb();
  const clients = (await db.getAll(STORE_CLIENTS)) as Client[];
  return clients.sort((a, b) => a.name.localeCompare(b.name));
}

export async function replaceAllClients(clients: Client[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(STORE_CLIENTS, 'readwrite');
  await tx.store.clear();
  for (const client of clients) await tx.store.put(client);
  await tx.done;
}

export async function getVisitHistory(
  clientId: string,
  now: WallClock = wallClockNow(),
): Promise<Appointment[]> {
  const all = await listAppointmentsByClient(clientId);
  return all
    .filter((a) => a.status !== 'cancelled' && isBefore(a.start, now))
    .sort((a, b) => (a.start.dateTime < b.start.dateTime ? 1 : -1));
}
```

`src/modules/clients/index.ts`:

```ts
export {
  addClient,
  getClient,
  getVisitHistory,
  listClients,
  replaceAllClients,
  updateClient,
} from './clients';
export type { Client } from './clients';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run` — expected: all passing.

- [ ] **Step 5: Verify checks and commit**

```bash
npm run format && npm run lint && npm run typecheck
git add -A && git commit -m "feat: add clients module with visit history"
```

---

### Task 6: `backup` module (TDD) — export, import, staleness

**Files:**

- Create: `src/modules/backup/backup.ts`, `src/modules/backup/index.ts`
- Test: `src/modules/backup/backup.test.ts`

**Interfaces:**

- Consumes: `settings` (`getSettings`, `replaceSettings`, `updateSettings`, `Settings` type, `DEFAULT_SETTINGS` in tests), `clients` (`listClients`, `replaceAllClients`, `addClient` in tests, `Client` type), `appointments` (`listAllAppointments`, `replaceAllAppointments`, `addAppointment` in tests, `Appointment` type), `db` (`destroyDb` in tests).
- Produces (public API of `backup`): `BACKUP_VERSION = 1`, `interface BackupFile { app: 'when-again'; version: 1; exportedAt: string; settings: Settings; clients: Client[]; appointments: Appointment[] }`, `exportBackup(now?: Date): Promise<BackupFile>` (also sets `lastBackupAt` to `now.toISOString()`), `parseBackup(data: unknown): BackupFile` (pure validation, throws `Error('invalid backup file')` on anything malformed), `importBackup(data: unknown): Promise<void>` (parse → replace all three stores), `isBackupStale(lastBackupAt: string | null, now?: Date): boolean` (true when null or older than 31 days).

- [ ] **Step 1: Write the failing test**

`src/modules/backup/backup.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { addAppointment, listAllAppointments } from '../appointments';
import { addClient, listClients } from '../clients';
import { destroyDb } from '../db';
import { getSettings, updateSettings } from '../settings';
import {
  exportBackup,
  importBackup,
  isBackupStale,
  parseBackup,
} from './backup';

afterEach(async () => {
  await destroyDb();
});

const at = (dateTime: string) => ({ dateTime, timeZone: 'Europe/Sofia' });

async function seed() {
  await updateSettings({ providerName: 'Salon Maria', language: 'bg' });
  const client = await addClient({ name: 'Anna', phone: '+359888123456' });
  await addAppointment({
    clientId: client.id,
    start: at('2026-08-21T14:00'),
    durationMinutes: 45,
    service: 'Haircut',
    price: 30,
    status: 'booked',
  });
}

describe('exportBackup', () => {
  it('captures settings, clients, and appointments, and stamps lastBackupAt', async () => {
    await seed();
    const now = new Date('2026-08-08T10:00:00.000Z');
    const backup = await exportBackup(now);
    expect(backup.app).toBe('when-again');
    expect(backup.version).toBe(1);
    expect(backup.exportedAt).toBe('2026-08-08T10:00:00.000Z');
    expect(backup.clients).toHaveLength(1);
    expect(backup.appointments).toHaveLength(1);
    expect(backup.settings.providerName).toBe('Salon Maria');
    expect((await getSettings()).lastBackupAt).toBe('2026-08-08T10:00:00.000Z');
  });
});

describe('export → wipe → import round-trip', () => {
  it('loses nothing', async () => {
    await seed();
    const backup = await exportBackup(new Date('2026-08-08T10:00:00.000Z'));
    const json = JSON.stringify(backup);

    await destroyDb(); // the wipe

    await importBackup(JSON.parse(json));
    expect(await getSettings()).toEqual(backup.settings);
    expect(await listClients()).toEqual(backup.clients);
    expect(await listAllAppointments()).toEqual(backup.appointments);
  });
});

describe('parseBackup', () => {
  it('rejects garbage', () => {
    expect(() => parseBackup(null)).toThrow('invalid backup file');
    expect(() => parseBackup({})).toThrow('invalid backup file');
    expect(() => parseBackup({ app: 'other', version: 1 })).toThrow(
      'invalid backup file',
    );
    expect(() => parseBackup({ app: 'when-again', version: 99 })).toThrow(
      'invalid backup file',
    );
  });
});

describe('isBackupStale', () => {
  const now = new Date('2026-08-08T00:00:00.000Z');
  it('is stale when never backed up', () => {
    expect(isBackupStale(null, now)).toBe(true);
  });
  it('is fresh within 31 days', () => {
    expect(isBackupStale('2026-07-20T00:00:00.000Z', now)).toBe(false);
  });
  it('is stale after 31 days', () => {
    expect(isBackupStale('2026-06-01T00:00:00.000Z', now)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run` — expected: FAIL, cannot resolve `./backup`.

- [ ] **Step 3: Write the implementation**

`src/modules/backup/backup.ts`:

```ts
import {
  listAllAppointments,
  replaceAllAppointments,
  type Appointment,
} from '../appointments';
import { listClients, replaceAllClients, type Client } from '../clients';
import {
  getSettings,
  replaceSettings,
  updateSettings,
  type Settings,
} from '../settings';

export const BACKUP_VERSION = 1;

export interface BackupFile {
  app: 'when-again';
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  settings: Settings;
  clients: Client[];
  appointments: Appointment[];
}

const STALE_AFTER_DAYS = 31;

export async function exportBackup(
  now: Date = new Date(),
): Promise<BackupFile> {
  const exportedAt = now.toISOString();
  const settings = await updateSettings({ lastBackupAt: exportedAt });
  return {
    app: 'when-again',
    version: BACKUP_VERSION,
    exportedAt,
    settings,
    clients: await listClients(),
    appointments: await listAllAppointments(),
  };
}

export function parseBackup(data: unknown): BackupFile {
  if (typeof data !== 'object' || data === null)
    throw new Error('invalid backup file');
  const d = data as Record<string, unknown>;
  if (
    d.app !== 'when-again' ||
    d.version !== BACKUP_VERSION ||
    typeof d.exportedAt !== 'string' ||
    typeof d.settings !== 'object' ||
    d.settings === null ||
    !Array.isArray(d.clients) ||
    !Array.isArray(d.appointments)
  ) {
    throw new Error('invalid backup file');
  }
  return data as BackupFile;
}

export async function importBackup(data: unknown): Promise<void> {
  const backup = parseBackup(data);
  await replaceSettings(backup.settings);
  await replaceAllClients(backup.clients);
  await replaceAllAppointments(backup.appointments);
}

export function isBackupStale(
  lastBackupAt: string | null,
  now: Date = new Date(),
): boolean {
  if (!lastBackupAt) return true;
  const ageMs = now.getTime() - new Date(lastBackupAt).getTime();
  return ageMs > STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;
}
```

Note for the reviewer: `getSettings` is imported for API completeness but unused — if lint flags it, drop the import; `exportBackup` reads settings via `updateSettings`'s return value on purpose (one write, one read).

`src/modules/backup/index.ts`:

```ts
export {
  BACKUP_VERSION,
  exportBackup,
  importBackup,
  isBackupStale,
  parseBackup,
} from './backup';
export type { BackupFile } from './backup';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run` — expected: all passing. The round-trip test is the epic's core "done when" — it must pass unmodified.

- [ ] **Step 5: Verify checks and commit**

```bash
npm run format && npm run lint && npm run typecheck
git add -A && git commit -m "feat: add backup module with export, import, and staleness check"
```

---

### Task 7: Full verification, push, PR

**Files:** none new.

**Interfaces:**

- Consumes: everything above.
- Produces: green CI on a PR closing epic issue #3.

- [ ] **Step 1: Full local verification**

```bash
npm run lint && npm run format:check && npm run typecheck && npm test -- --run && npm run test:e2e
```

Expected: everything green (e2e still 2 smoke tests — this epic adds no UI).

- [ ] **Step 2: Push and open the PR**

```bash
git push -u origin epic-3-data-layer
gh pr create --draft --title "Epic 3: Local data layer & backup" --body "Adds the time, db, settings, appointments, clients, and backup modules with full unit coverage on fake-indexeddb. No UI — modules are consumed by later epics.

Closes #3.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
gh pr checks --watch
```

Expected: CI green. Fix and re-push if not.

---

## Self-Review Notes

- Spec coverage: Data model table (Client/Appointment/Settings fields) → Tasks 3–5 types; wall-clock + timezone-name semantics → Task 1 + Appointment.start; backup export/import/staleness → Task 6; persistent-storage request → Task 2 (`requestPersistentStorage`, call site arrives with first real UI); modulith module ownership table → module-per-task layout. The monthly-nag UI and export/import UI are later epics (settings/backup screens); this epic ships their logic.
- Type consistency: `WallClock` (Task 1) used by `Appointment.start` (Task 4) and `getVisitHistory` (Task 5); `replaceAll*`/`replaceSettings` (Tasks 3–5) consumed by `importBackup` (Task 6); store/index constants (Task 2) consumed by Tasks 3–5.
- Dependency graph check: settings→db, appointments→db+time, clients→db+appointments+time, backup→settings+clients+appointments. Acyclic; db and time remain leaves.
