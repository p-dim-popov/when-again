# Dexie.js Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `idb` IndexedDB wrapper with Dexie.js — typed tables (no `as` casts) and reactive `useLiveQuery` reads that retire `@tanstack/react-query` for local data.

**Architecture:** `db` becomes a zero-knowledge leaf (`export const db = new Dexie('when-again') as WhenAgainDB`). Each entity module contributes its store's **schema** via a `defineXStore(db)` visitor (called from `src/app/main.tsx`) and its **type** via a `declare module '../db'` augmentation. Reads move from react-query `useQuery` to `dexie-react-hooks` `useLiveQuery`; writes drop all `invalidateQueries`.

**Tech Stack:** React + Vite + TanStack Router, TypeScript strict, Dexie.js + dexie-react-hooks, Vitest + fake-indexeddb, Playwright.

**Spec:** `docs/specs/2026-08-10-dexie-migration-design.md` (read it — this plan implements it).

## Global Constraints

- **Modulith:** cross-module imports go through `index.ts` only; graph stays acyclic. `dexie` (engine) imported **only** in data-layer modules (`db` + `appointments`/`clients`/`settings`/`received`/`backup`). `dexie-react-hooks` (`useLiveQuery`) allowed in UI modules only. `db` imports no entity module.
- **`db` is a leaf** — knows no store name or type; entity modules push both (schema visitor + type augmentation). `src/app/main.tsx` is the only place referencing all four `defineXStore`.
- **Entity-module public APIs are unchanged** — only internals swap. No consumer changes because of the table swap; the only consumer churn is the reactive-read swap.
- **Wall-clock semantics unchanged:** appointments store `{ dateTime: 'YYYY-MM-DDTHH:mm', timeZone }`, never epoch/UTC. IDs are `crypto.randomUUID()`; settings singleton id is `'singleton'`.
- **Store keyPath is `id`** (not `++id` — never auto-generate). `appointments` indexes: `clientId`, `start.dateTime`.
- **Locale sort:** `clients.listClients` keeps its JS `name.localeCompare` sort (Dexie `.orderBy` is binary-collated, wrong for Cyrillic). Only `start.dateTime` sorts move to `.sortBy('start.dateTime')`.
- **Backup JSON format unchanged:** `{ app: 'when-again', version: 1, exportedAt, settings, clients, appointments }`.
- **TypeScript pinned `~6.0.3`** — do not change. Package manager **npm**; commit `package-lock.json`.
- **CI gate:** `npm run test`, `tsc -b` (typecheck), `eslint .`, and Prettier `format:check` must all be clean. Run `npx prettier --check .` before committing (ESLint-clean ≠ Prettier-clean).
- **STE / copy:** no user-facing string changes in this migration.
- **No Claude session link** in commit messages (the `Co-Authored-By` / "Generated with Claude Code" attribution is fine).

---

## Task 1: Data-layer core — Dexie `db`, four entity stores, backup, test setup

Swaps the entire data layer to Dexie in one atomic move (removing `getDb()` breaks every entity module at once, so they migrate together). After this task the data lives in Dexie; **react-query still reads over it unchanged** (entity signatures preserved), so the app and all suites stay green. Deps: **add** `dexie` + `dexie-react-hooks`; **do not** remove `idb`/`@tanstack/react-query` yet (Task 6).

**Files:**
- Modify: `package.json` (add deps), `package-lock.json`
- Rewrite: `src/modules/db/db.ts`, `src/modules/db/index.ts`
- Rewrite internals: `src/modules/appointments/appointments.ts`, `src/modules/clients/clients.ts`, `src/modules/settings/settings.ts`, `src/modules/received/received.ts`, `src/modules/backup/backup.ts`
- Modify exports: `src/modules/appointments/index.ts`, `src/modules/clients/index.ts`, `src/modules/settings/index.ts`, `src/modules/received/index.ts`
- Create: `src/test/setup-db.ts`
- Modify: `vitest.config.ts` (wire `setupFiles`), `src/app/main.tsx` (register stores at top of `bootstrap`)
- Rewrite tests: `src/modules/db/db.test.ts`; adjust `appointments.test.ts`, `clients.test.ts`, `settings.test.ts`, `received.test.ts`, `backup.test.ts` (drop per-file `import 'fake-indexeddb/auto'`, rely on setup)

**Interfaces:**
- Consumes: nothing (foundation).
- Produces:
  - `db/index.ts` exports: `db` (the Dexie instance), `WhenAgainDB` (type), `destroyDb(): Promise<void>`, `requestPersistentStorage(): Promise<boolean>`.
  - Each entity module's `index.ts` additionally exports its visitor: `defineAppointmentsStore(db: Dexie): void`, `defineClientsStore(db: Dexie): void`, `defineSettingsStore(db: Dexie): void`, `defineReceivedStore(db: Dexie): void`.
  - Entity public functions keep exact current signatures (see each sub-step).

- [ ] **Step 1: Add dependencies**

```bash
npm install dexie@^4 dexie-react-hooks@^1
```

Run `git diff package.json` — confirm `dexie` and `dexie-react-hooks` are in `dependencies`. Leave `idb` and `@tanstack/react-query` in place for now.

- [ ] **Step 2: Rewrite `src/modules/db/db.ts`** (whole file)

```ts
import Dexie from 'dexie';

// Zero-knowledge leaf. Each entity module contributes its typed table by
// augmenting this interface via `declare module '../db'`, and its schema via a
// `defineXStore(db)` visitor the composition root (src/app/main.tsx, and the
// Vitest setup) calls before the database is first used.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface WhenAgainDB extends Dexie {}

export const db = new Dexie('when-again') as WhenAgainDB;

/** Close and delete the database. Test helper — never called by app code. */
export async function destroyDb(): Promise<void> {
  await db.delete();
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

- [ ] **Step 3: Rewrite `src/modules/db/index.ts`** (whole file)

```ts
export { db, destroyDb, requestPersistentStorage, type WhenAgainDB } from './db';
```

- [ ] **Step 4: Migrate `src/modules/appointments/appointments.ts`** (whole file)

Keep every exported signature. Add the augmentation + visitor; swap reads to `db.appointments`.

```ts
import Dexie, { type EntityTable } from 'dexie';
import { db } from '../db';
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

declare module '../db' {
  interface WhenAgainDB {
    appointments: EntityTable<Appointment, 'id'>;
  }
}

export function defineAppointmentsStore(db: Dexie): void {
  db.version(1).stores({ appointments: 'id, clientId, start.dateTime' });
}

export async function addAppointment(
  data: Omit<Appointment, 'id'>,
): Promise<Appointment> {
  const appointment: Appointment = { id: crypto.randomUUID(), ...data };
  await db.appointments.add(appointment);
  return appointment;
}

export async function updateAppointment(
  appointment: Appointment,
): Promise<void> {
  await db.appointments.put(appointment);
}

export async function getAppointment(
  id: string,
): Promise<Appointment | undefined> {
  return db.appointments.get(id);
}

export async function listAppointmentsOnDate(
  date: string,
): Promise<Appointment[]> {
  return db.appointments
    .where('start.dateTime')
    .between(`${date}T00:00`, `${date}T23:59`, true, true)
    .sortBy('start.dateTime');
}

export async function listAppointmentsByClient(
  clientId: string,
): Promise<Appointment[]> {
  return db.appointments
    .where('clientId')
    .equals(clientId)
    .sortBy('start.dateTime');
}

export async function listAllAppointments(): Promise<Appointment[]> {
  return db.appointments.toArray();
}

export async function replaceAllAppointments(
  items: Appointment[],
): Promise<void> {
  await db.transaction('rw', db.appointments, async () => {
    await db.appointments.clear();
    await db.appointments.bulkPut(items);
  });
}
```

- [ ] **Step 5: Export the visitor from `src/modules/appointments/index.ts`**

Add `defineAppointmentsStore` to the existing export list (keep all current exports).

- [ ] **Step 6: Migrate `src/modules/clients/clients.ts`** (whole file)

Note: `listClients` **keeps** its JS `localeCompare` sort. `getVisitHistory` is unchanged (it already delegates to `listAppointmentsByClient` + time helpers).

```ts
import Dexie, { type EntityTable } from 'dexie';
import { listAppointmentsByClient, type Appointment } from '../appointments';
import { db } from '../db';
import {
  compareWallClock,
  isBefore,
  wallClockNow,
  type WallClock,
} from '../time';

export interface Client {
  id: string;
  name: string;
  phone?: string;
  notes?: string;
}

declare module '../db' {
  interface WhenAgainDB {
    clients: EntityTable<Client, 'id'>;
  }
}

export function defineClientsStore(db: Dexie): void {
  db.version(1).stores({ clients: 'id' });
}

export async function addClient(data: Omit<Client, 'id'>): Promise<Client> {
  const client: Client = { id: crypto.randomUUID(), ...data };
  await db.clients.add(client);
  return client;
}

export async function updateClient(client: Client): Promise<void> {
  await db.clients.put(client);
}

export async function getClient(id: string): Promise<Client | undefined> {
  return db.clients.get(id);
}

export async function listClients(): Promise<Client[]> {
  const clients = await db.clients.toArray();
  return clients.sort((a, b) => a.name.localeCompare(b.name));
}

export async function replaceAllClients(clients: Client[]): Promise<void> {
  await db.transaction('rw', db.clients, async () => {
    await db.clients.clear();
    await db.clients.bulkPut(clients);
  });
}

export async function getVisitHistory(
  clientId: string,
  now: WallClock = wallClockNow(),
): Promise<Appointment[]> {
  const all = await listAppointmentsByClient(clientId);
  return all
    .filter((a) => a.status !== 'cancelled' && isBefore(a.start, now))
    .sort((a, b) => compareWallClock(b.start, a.start));
}
```

- [ ] **Step 7: Export the visitor from `src/modules/clients/index.ts`** (add `defineClientsStore`, keep the rest).

- [ ] **Step 8: Migrate `src/modules/settings/settings.ts`** (whole file)

The singleton pattern is unchanged; only the storage calls swap. The table row type is `StoredSettings` (`Settings & { id: 'singleton' }`).

```ts
import Dexie, { type EntityTable } from 'dexie';
import { db } from '../db';

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

declare module '../db' {
  interface WhenAgainDB {
    settings: EntityTable<StoredSettings, 'id'>;
  }
}

export function defineSettingsStore(db: Dexie): void {
  db.version(1).stores({ settings: 'id' });
}

export async function getSettings(): Promise<Settings> {
  const stored = await db.settings.get(SINGLETON_ID);
  // Fresh services array each call: DEFAULT_SETTINGS.services must never be
  // shared/mutated across callers.
  const defaults: Settings = { ...DEFAULT_SETTINGS, services: [] };
  if (!stored) return defaults;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, ...settings } = stored;
  return { ...defaults, ...settings };
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
  await db.settings.put({ id: SINGLETON_ID, ...settings } satisfies StoredSettings);
}
```

- [ ] **Step 9: Export the visitor from `src/modules/settings/index.ts`** (add `defineSettingsStore`, keep the rest).

- [ ] **Step 10: Migrate `src/modules/received/received.ts`** (whole file)

```ts
import Dexie, { type EntityTable } from 'dexie';
import { db } from '../db';
import { type WallClock } from '../time';

export interface ReceivedAppointment {
  id: string;
  providerName: string;
  address?: string;
  service: string;
  start: WallClock;
  durationMinutes: number;
  status: 'booked' | 'cancelled';
}

declare module '../db' {
  interface WhenAgainDB {
    received: EntityTable<ReceivedAppointment, 'id'>;
  }
}

export function defineReceivedStore(db: Dexie): void {
  db.version(1).stores({ received: 'id' });
}

export async function getReceived(
  id: string,
): Promise<ReceivedAppointment | undefined> {
  return db.received.get(id);
}

export async function upsertReceived(appt: ReceivedAppointment): Promise<void> {
  await db.received.put(appt);
}

export async function listReceived(): Promise<ReceivedAppointment[]> {
  return db.received.toArray();
}
```

- [ ] **Step 11: Export the visitor from `src/modules/received/index.ts`** (add `defineReceivedStore`, keep the rest).

- [ ] **Step 12: Migrate `src/modules/backup/backup.ts`** — atomic import transaction

Only `importBackup` changes; wrap the three replacements in one Dexie transaction. `db` is imported directly (backup is a data-layer module).

```ts
import {
  listAllAppointments,
  replaceAllAppointments,
  type Appointment,
} from '../appointments';
import { listClients, replaceAllClients, type Client } from '../clients';
import { db } from '../db';
import { replaceSettings, updateSettings, type Settings } from '../settings';

// ... BACKUP_VERSION, BackupFile, STALE_AFTER_DAYS, exportBackup, parseBackup,
// isBackupStale all UNCHANGED ...

export async function importBackup(data: unknown): Promise<void> {
  const backup = parseBackup(data);
  await db.transaction('rw', db.clients, db.appointments, db.settings, async () => {
    await replaceSettings(backup.settings);
    await replaceAllClients(backup.clients);
    await replaceAllAppointments(backup.appointments);
  });
}
```

> Note: `replaceAllClients`/`replaceAllAppointments` open their own `rw` transactions on a single table; Dexie **nests** them into the outer transaction because each scope is a subset of `{ clients, appointments, settings }` and the mode matches. `replaceSettings` is a bare `put` that simply joins the active transaction. Both are safe inside the outer block — do not change their bodies. The awaits run in sequence (no zone-losing gaps), so Dexie's transaction zone propagates correctly.

- [ ] **Step 13: Create `src/test/setup-db.ts`** — the test composition root

```ts
import 'fake-indexeddb/auto';
import { afterEach } from 'vitest';
import { db } from '../modules/db';
import { defineAppointmentsStore } from '../modules/appointments';
import { defineClientsStore } from '../modules/clients';
import { defineSettingsStore } from '../modules/settings';
import { defineReceivedStore } from '../modules/received';

// Register every store once, before any test touches the DB. A missing store is
// a hard throw, and cross-store readers (e.g. clients.getVisitHistory reads the
// appointments store) need the full schema.
defineAppointmentsStore(db);
defineClientsStore(db);
defineSettingsStore(db);
defineReceivedStore(db);

// Isolate every test: delete the database after each. The version declarations
// live on the `db` instance, so the next operation reopens with the same schema.
afterEach(async () => {
  await db.delete();
});
```

- [ ] **Step 14: Wire the setup file** — `vitest.config.ts`

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test/setup-db.ts'],
    passWithNoTests: true,
  },
});
```

- [ ] **Step 15: Register stores in `src/app/main.tsx`** — before the first DB op

`bootstrap()` calls `getSettings()` (a DB read) before render, so registration must be the first thing it does. Add the imports and the registration block at the very top of `bootstrap`:

```ts
import { db } from '../modules/db';
import { defineAppointmentsStore } from '../modules/appointments';
import { defineClientsStore } from '../modules/clients';
import { defineSettingsStore } from '../modules/settings';
import { defineReceivedStore } from '../modules/received';

async function bootstrap() {
  defineAppointmentsStore(db);
  defineClientsStore(db);
  defineSettingsStore(db);
  defineReceivedStore(db);

  registerStrings('en', { /* unchanged */ });
  // ... rest of bootstrap unchanged (QueryClientProvider stays for now) ...
}
```

- [ ] **Step 16: Rewrite `src/modules/db/db.test.ts`** (whole file)

Delete the probe/migration tests (`memoizes the connection`, `persists across close and reopen`, `concurrent getDb calls after close`, the v1→v2 migration test) — they tested machinery that no longer exists. Keep a schema/round-trip smoke and `requestPersistentStorage`. Stores are registered by the setup file, so this test needs no `import 'fake-indexeddb/auto'` and no store setup of its own.

```ts
import { describe, expect, it } from 'vitest';
import { db, requestPersistentStorage } from './db';

describe('db', () => {
  it('exposes the four registered stores', () => {
    expect(db.tables.map((t) => t.name).sort()).toEqual(
      ['appointments', 'clients', 'received', 'settings'].sort(),
    );
  });

  it('round-trips a record through a registered store', async () => {
    await db.clients.put({ id: 'c1', name: 'Maria' });
    expect(await db.clients.get('c1')).toEqual({ id: 'c1', name: 'Maria' });
  });
});

describe('requestPersistentStorage', () => {
  it('returns false when the API is unavailable', async () => {
    expect(await requestPersistentStorage()).toBe(false);
  });
});
```

> `db.clients` is typed here because the clients module's augmentation is in the compilation. If `db.tables` is empty, the setup file did not run — check `vitest.config.ts`.

- [ ] **Step 17: Update the four entity test files + backup test**

In `appointments.test.ts`, `clients.test.ts`, `settings.test.ts`, `received.test.ts`, `backup.test.ts`: remove the top-line `import 'fake-indexeddb/auto';` and the local `afterEach(destroyDb)` block (both now provided by `src/test/setup-db.ts`); remove now-unused imports of `destroyDb`. Do **not** change the assertions — the entity public APIs are unchanged, so the existing behavioural tests still pass against Dexie. If any test reached into `getDb()`/idb internals directly, rewrite that line to the Dexie surface (imported `db`).

- [ ] **Step 18: Run the full unit suite**

Run: `npm run test`
Expected: PASS (all existing data-layer + entity + backup tests green on Dexie). Investigate any failure before moving on — a `SchemaError`/missing-store usually means the setup file is not wired.

- [ ] **Step 19: Typecheck, lint, format**

Run: `npx tsc -b && npx eslint . && npx prettier --check .`
Expected: clean. (No `as Appointment`-style casts remain in the migrated entity modules.)

- [ ] **Step 20: Commit**

```bash
git add -A
git commit -m "feat: migrate data layer from idb to Dexie (typed stores, visitor schema)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: `schedule` reads → `useLiveQuery`

Swaps the three schedule hooks to reactive reads and updates their sole consumer, `ScheduleScreen`. react-query and `useLiveQuery` coexist fine (the `QueryClientProvider` is still mounted), so this task is independent.

**Files:**
- Rewrite: `src/modules/schedule/queries.ts`
- Modify: `src/modules/schedule/ScheduleScreen.tsx:200-202` (consumer destructuring)

**Interfaces:**
- Consumes: `listAppointmentsOnDate`, `listClients`, `getSettings` (unchanged from Task 1).
- Produces: `useDayAppointments(dateKey: string): Appointment[] | undefined`, `useAllClients(): Client[] | undefined`, `useProviderSettings(): Settings | undefined` (return the value directly; `undefined` = loading).

- [ ] **Step 1: Rewrite `src/modules/schedule/queries.ts`** (whole file)

```ts
import { useLiveQuery } from 'dexie-react-hooks';
import { listAppointmentsOnDate } from '../appointments';
import { listClients } from '../clients';
import { getSettings } from '../settings';

export function useDayAppointments(dateKey: string) {
  return useLiveQuery(() => listAppointmentsOnDate(dateKey), [dateKey]);
}

export function useAllClients() {
  return useLiveQuery(() => listClients(), []);
}

export function useProviderSettings() {
  return useLiveQuery(() => getSettings(), []);
}
```

- [ ] **Step 2: Update `ScheduleScreen.tsx` consumers** (lines ~200-202)

Replace:

```ts
  const { data: appointments, isPending } = useDayAppointments(dateKey);
  const { data: clients } = useAllClients();
  const { data: settings } = useProviderSettings();
```

with:

```ts
  const appointments = useDayAppointments(dateKey);
  const isPending = appointments === undefined;
  const clients = useAllClients();
  const settings = useProviderSettings();
```

`appointments`, `clients`, `settings` are now `T | undefined` (same nullability react-query gave via `data`), so downstream `appointments ?? []` / guards are unchanged. Keep every existing use of `isPending`.

- [ ] **Step 3: Run tests + typecheck + lint + format**

Run: `npm run test && npx tsc -b && npx eslint . && npx prettier --check .`
Expected: clean. (Schedule has no unit test that mocks react-query; if `tsc` flags a changed `isPending`/`data` type elsewhere in `ScheduleScreen`, fix the destructuring at that site.)

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: schedule reads via useLiveQuery

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: `booking` mutations + `AppointmentForm` reads → Dexie/liveQuery

Rewrites `booking/mutations.ts` to drop react-query while **preserving the `{ mutateAsync, isPending }` shape** its call sites use, and swaps `AppointmentForm`'s three `useQuery` reads to `useLiveQuery` (dropping the settings `invalidateQueries`).

**Files:**
- Rewrite: `src/modules/booking/mutations.ts`
- Modify: `src/modules/booking/AppointmentForm.tsx` (reads at ~128-182; remove `useQueryClient` + the line ~454 `invalidateQueries`)

**Interfaces:**
- Consumes: `addAppointment`, `updateAppointment` (`appointments`), `addClient` (`clients`), `getAppointment`, `getClient`, `listClients`, `getSettings` (all unchanged).
- Produces (unchanged call surface): `useSaveAppointment()`, `useUpdateAppointment()`, `useCancelAppointment()`, `useAddClient()` — each returns `{ mutateAsync, isPending }`. `mutateAsync` resolves to: save → `Appointment`; update → `Appointment`; cancel → `Appointment`; addClient → `Client`.

- [ ] **Step 1: Rewrite `src/modules/booking/mutations.ts`** (whole file)

No react-query. A tiny `useAsyncAction` hook preserves `{ mutateAsync, isPending }`; module-level action fns keep `mutateAsync` identity stable. No `invalidateQueries` — `useLiveQuery` readers update automatically on the underlying table write.

```ts
import { useCallback, useState } from 'react';
import {
  addAppointment,
  updateAppointment,
  type Appointment,
} from '../appointments';
import { addClient, type Client } from '../clients';

function useAsyncAction<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
) {
  const [isPending, setPending] = useState(false);
  const mutateAsync = useCallback(
    async (...args: TArgs) => {
      setPending(true);
      try {
        return await fn(...args);
      } finally {
        setPending(false);
      }
    },
    [fn],
  );
  return { mutateAsync, isPending };
}

const saveFn = (data: Omit<Appointment, 'id'>) => addAppointment(data);
const updateFn = async (appointment: Appointment) => {
  await updateAppointment(appointment);
  return appointment;
};
const cancelFn = async (appointment: Appointment) => {
  const cancelled: Appointment = { ...appointment, status: 'cancelled' };
  await updateAppointment(cancelled);
  return cancelled;
};
const addClientFn = (data: Omit<Client, 'id'>) => addClient(data);

export const useSaveAppointment = () => useAsyncAction(saveFn);
export const useUpdateAppointment = () => useAsyncAction(updateFn);
export const useCancelAppointment = () => useAsyncAction(cancelFn);
export const useAddClient = () => useAsyncAction(addClientFn);
```

- [ ] **Step 2: Swap `AppointmentForm.tsx` reads to `useLiveQuery`**

Add the import `import { useLiveQuery } from 'dexie-react-hooks';` and remove `useQuery` / `useQueryClient` from the `@tanstack/react-query` import (delete the import line entirely once unused).

Replace the `editLoad` query (~128-140):

```ts
  const editLoad = useLiveQuery(
    () =>
      editingId != null
        ? (async () => {
            const appointment = await getAppointment(editingId);
            if (!appointment) return null;
            const client = await getClient(appointment.clientId);
            return { appointment, clientName: client?.name ?? '' };
          })()
        : undefined,
    [editingId],
  );
```

Replace the `clients` and `settings` queries (~175-182):

```ts
  const clients = useLiveQuery(() => listClients(), []);
  const settings = useLiveQuery(() => getSettings(), []);
```

`editLoad` is `{ appointment, clientName } | null | undefined` (undefined = loading, null = no such appointment) — same shape the hydrate logic already tolerates (`if (editLoad) …`). `clients`/`settings` are `T | undefined`, matching the previous react-query `data`.

- [ ] **Step 3: Remove the settings `invalidateQueries`** (~454)

Delete the line `void queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY });` — the `settings` live query re-reads automatically after `updateSettings`. Remove the now-unused `const queryClient = useQueryClient();` (~95) and the `CLIENTS_QUERY_KEY` / `SETTINGS_QUERY_KEY` consts (~45-46) if nothing else references them (grep first).

- [ ] **Step 4: Run tests + typecheck + lint + format**

Run: `npm run test && npx tsc -b && npx eslint . && npx prettier --check .`
Expected: clean. The `booking` unit tests (remembered-service logic, clash check) exercise pure functions and are unaffected; `mutateAsync`/`isPending` call sites (lines ~373/428/431/476/484/732) compile unchanged.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: booking mutations off react-query; form reads via useLiveQuery

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: `booking` MonthPicker + ShareLanding reads → `useLiveQuery`

Swaps the two remaining booking `useQuery` reads and deletes the obsolete cache-shape coupling commentary in `ShareLanding` (there is no shared key-cache under liveQuery).

**Files:**
- Modify: `src/modules/booking/MonthPicker.tsx` (the `useQuery` at ~65)
- Modify: `src/modules/booking/ShareLanding.tsx` (the two `useQuery` at ~42/56; drop the cache-shape comment block)

**Interfaces:**
- Consumes: `listAllAppointments`, `getAppointment`, `getClient`, `getSettings` (unchanged).
- Produces: no new exports; component behaviour unchanged.

- [ ] **Step 1: MonthPicker** — replace the `useQuery` (~65)

Add `import { useLiveQuery } from 'dexie-react-hooks';`, remove the `useQuery` import. Replace:

```ts
  const { data: appointments } = useQuery({
    queryKey: ['appointments', 'all'],
    queryFn: listAllAppointments,
  });
```

with:

```ts
  const appointments = useLiveQuery(() => listAllAppointments(), []);
```

The consumer already reads `appointments ?? []`, so undefined-loading is handled.

- [ ] **Step 2: ShareLanding** — replace both `useQuery` reads (~42-59)

Add `import { useLiveQuery } from 'dexie-react-hooks';`, remove the `useQuery` import. Replace the `record` query and the `settings` query. Delete the long comment block (~25-41 and ~60-66) explaining the `['appointment', id]` cache-shape matching — it no longer applies (each live closure returns its own shape; no shared cache).

```ts
  const record = useLiveQuery(
    () =>
      appointmentId != null
        ? (async () => {
            const appointment = await getAppointment(appointmentId);
            if (!appointment) return null;
            const client = await getClient(appointment.clientId);
            return { appointment, clientName: client?.name ?? '' };
          })()
        : undefined,
    [appointmentId],
  );
  const appointment = record?.appointment;
  const settings = useLiveQuery(() => getSettings(), []);
```

`record` is `{ appointment, clientName } | null | undefined`; existing `record?.appointment` / `record?.clientName` reads are unaffected.

- [ ] **Step 3: Run tests + typecheck + lint + format**

Run: `npm run test && npx tsc -b && npx eslint . && npx prettier --check .`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: MonthPicker + ShareLanding reads via useLiveQuery

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: `handoff` ImportScreen reads → `useLiveQuery` (with loading-sentinel wrapper)

Swaps the `stored` read to `useLiveQuery` and drops the post-write `invalidateQueries`. **Critical:** `getReceived` resolves to `undefined` for a genuinely-new appointment, but `useLiveQuery` also uses `undefined` as its loading sentinel — so the raw value cannot distinguish "loading" from "new, not stored." Wrap the result in `{ value }` so `undefined` unambiguously means loading.

**Files:**
- Modify: `src/modules/handoff/ImportScreen.tsx` (the `useQuery` at ~107-111; the loading gate ~161; the `write()` `invalidateQueries` ~169; remove `useQueryClient` ~78)

**Interfaces:**
- Consumes: `getReceived`, `upsertReceived` (unchanged).
- Produces: no new exports; behaviour unchanged (new/changed/cancelled/up-to-date classification intact, including a NEW appointment that has no stored record).

- [ ] **Step 1: Write the failing e2e-style guard (unit) for the NEW case**

The existing round-trip e2e already covers new/changed/cancelled; add a focused unit assertion that the wrapper distinguishes loading from not-found so a regression (blank "New" screen) is caught. In `src/modules/handoff/classify.test.ts` (or wherever `classifyImport` is tested), confirm there is a case `classifyImport(incoming, undefined) → { kind: 'new' }`. If present already, no new test needed; if absent, add:

```ts
it('classifies an appointment with no stored record as new', () => {
  const incoming = { id: 'a1', providerName: 'X', service: 'Cut', start: { dateTime: '2026-09-01T10:00', timeZone: 'Europe/Sofia' }, durationMinutes: 30, status: 'booked' as const };
  expect(classifyImport(incoming, undefined).kind).toBe('new');
});
```

Run: `npm run test -- classify` → expected PASS (documents the contract the wrapper must preserve).

- [ ] **Step 2: Swap the `stored` read to a wrapped `useLiveQuery`**

Add `import { useLiveQuery } from 'dexie-react-hooks';`; remove `useQuery` / `useQueryClient` from the react-query import (delete the import line once unused, and the `const queryClient = useQueryClient();` at ~78). Replace the `stored` query (~107-111):

```ts
  const storedResult = useLiveQuery(
    () =>
      incomingId != null
        ? getReceived(incomingId).then((value) => ({ value }))
        : undefined,
    [incomingId],
  );
```

- [ ] **Step 3: Fix the loading gate** (~161)

Replace `if (storedLoading) return null;` with:

```ts
  if (incomingId != null && storedResult === undefined) return null;
  const stored = storedResult?.value;
```

Then the existing `const outcome = classifyImport(incoming, stored);` works — `stored` is `ReceivedAppointment | undefined`, and `undefined` here now means genuinely-not-stored (the New case), never loading.

- [ ] **Step 4: Drop the post-write invalidation** (~169)

In `write()`, delete `await queryClient.invalidateQueries({ queryKey: ['received'] });`. The write sets `saved` (which switches to the confirmation screen) and any other `received` live reader updates automatically.

- [ ] **Step 5: Run tests + typecheck + lint + format**

Run: `npm run test && npx tsc -b && npx eslint . && npx prettier --check .`
Expected: clean.

- [ ] **Step 6: Run the e2e round-trip**

Run: `npm run test:e2e` (builds, then runs Playwright)
Expected: PASS — the booking → share → import round-trip (new + cancelled) still asserts exactly one `received` record and the cancelled end state. This round-trip (a write reflected in a later live read) is the migration's reactivity guard.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: ImportScreen read via useLiveQuery with loading-sentinel wrapper

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Cleanup — retire react-query + idb, composition root, CLAUDE.md, bundle

Removes the now-dead react-query wiring and the `idb` dependency, updates CLAUDE.md for the new boundaries, and records the bundle delta. After Task 5 nothing imports `@tanstack/react-query` except `main.tsx` + `queryClient.ts`, and nothing imports `idb`.

**Files:**
- Modify: `src/app/main.tsx` (remove `QueryClientProvider`)
- Delete: `src/app/queryClient.ts`
- Modify: `package.json`, `package-lock.json` (remove `@tanstack/react-query`, `idb`)
- Modify: `CLAUDE.md` (data-layer + Dexie boundary rules)

**Interfaces:**
- Consumes: everything from Tasks 1-5.
- Produces: final state — no react-query, no idb anywhere.

- [ ] **Step 1: Confirm no stragglers**

Run: `grep -rn "@tanstack/react-query\|from 'idb'\|useQuery\|useMutation\|invalidateQueries\|QueryClient" src`
Expected: only `src/app/main.tsx` and `src/app/queryClient.ts` (react-query) and nothing for `idb`. If any UI module still shows a react-query symbol, fix it before continuing (it belongs to an earlier task).

- [ ] **Step 2: Remove `QueryClientProvider` from `main.tsx`**

Delete the `import { QueryClientProvider } from '@tanstack/react-query';`, the `import { createQueryClient } from './queryClient';`, the `const queryClient = createQueryClient();`, and unwrap the render so `<App />` is a direct child of `<StrictMode>`:

```ts
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
```

- [ ] **Step 3: Delete `src/app/queryClient.ts`**

```bash
git rm src/app/queryClient.ts
```

- [ ] **Step 4: Remove dead dependencies**

```bash
npm uninstall @tanstack/react-query idb
```

Confirm `git diff package.json` drops both and that `dexie` + `dexie-react-hooks` remain.

- [ ] **Step 5: Update `CLAUDE.md`**

In the "Stack & tooling" / storage section, replace the idb line and add the Dexie boundary rules. Concretely:

- Change the storage line to: *"Storage: IndexedDB via **Dexie.js** (`dexie` + `dexie-react-hooks`); unit tests use `fake-indexeddb`."*
- Under the modulith architecture notes, replace *"`db` holds store names/indexes only, no entity types"* with: *"`db` is a zero-knowledge leaf holding only the Dexie instance; each entity module contributes its store **schema** via an exported `defineXStore(db)` visitor (assembled in `src/app/main.tsx`) and its **type** via a `declare module '../db'` augmentation. `dexie` is imported only in data-layer modules (`db` + entity modules + `backup`); `dexie-react-hooks` (`useLiveQuery`) is the reactive read primitive for UI modules. Local reads are reactive — no manual cache invalidation."*

- [ ] **Step 6: Measure the bundle delta**

```bash
npm run build
```

Record the built JS size (e.g. `du -sh dist/assets` or the Vite build summary's gzip figures) in the PR description as before/after. Expected: net increase on the order of the Dexie add minus the react-query removal.

- [ ] **Step 7: Full green gate**

Run: `npm run test && npx tsc -b && npx eslint . && npx prettier --check . && npm run test:e2e`
Expected: all clean. The e2e round-trip is the reactive-behaviour assertion required by the spec's acceptance criteria (no unit hook-render harness exists in the stack — tests are node-env `*.test.ts`).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: retire react-query and idb; document Dexie data-layer boundaries

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Notes for the executor

- **Ordering invariant:** any code path that touches the DB must run after the store visitors. App: `main.tsx` registers first in `bootstrap`. Tests: `src/test/setup-db.ts` (`setupFiles`) registers before every test file. If you see a Dexie `SchemaError` / "table X does not exist," a visitor did not run — do not "fix" it by re-declaring the store inside the failing module.
- **Do not** convert `listClients`' `localeCompare` to Dexie `.orderBy` (binary collation is wrong for Cyrillic).
- **Do not** remove `@tanstack/react-query` from `package.json` before Task 6 — earlier tasks still import it in not-yet-migrated files.
- **`db.transaction` nesting** in `importBackup` is intentional and safe (inner `replaceAll*` transactions nest into the outer one). Keep the inner helpers' bodies untouched.
- Reactivity has **no** invalidation step anywhere. If you feel the urge to "refresh" after a write, that is react-query muscle memory — delete the urge, not add a call.
