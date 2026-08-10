# Dexie.js Migration — Design

**Issue:** #31 · **Branch:** `dexie-migration` · **Date:** 2026-08-10

## Goal

Replace the `idb` IndexedDB wrapper with **Dexie.js**, giving the data layer
compile-time-typed tables (no `as` casts) and **reactive local reads**
(`useLiveQuery`) that auto-update on writes — retiring `@tanstack/react-query`
for local data. One branch, one epic.

## Motivation

The current `idb` setup works but carries two structural warts that compound
as more UI is built (`#5` provider clients, `#7` client mode):

1. **Untyped reads** — every entity module casts (`as Appointment`, …); no
   compile-time guarantee the stored shape matches the type.
2. **Manual cache invalidation** — local reads go through react-query, so
   every mutation must remember to `invalidateQueries`. react-query is built
   for *server* state this app does not have; the manual invalidation is a
   live source of fragility — the byte-for-byte cache-shape coupling between
   `ShareLanding` and `AppointmentForm`, and the classify-flash gate in `#6`.

Dexie fixes both: typed `Table<T, Key>`, richer queries, and — the key win —
`liveQuery`/`useLiveQuery` reactive reads that re-run automatically on any
write to the tables they read, with no manual invalidation. For a no-server
app, reactive local queries are the more correct architecture.

## Non-goals / scope boundaries

- **No data-migration ceremony.** The app currently holds only throwaway test
  data (maintainer's own testing). There is **no data-preservation
  requirement** and **no seeded-v2 regression test**. Dexie's automatic
  upgrade adopts the existing on-device DB non-destructively for free (see
  §7); if anything ever looks off, clearing site data once is an acceptable
  fallback. This is the single biggest simplification versus a production
  migration.
- **No behaviour change for the user.** Same screens, same flows, same backup
  JSON format, same wall-clock semantics.
- **No new features.** `#5`/`#7`/`#8` remain separate epics; this only
  re-plumbs the data layer beneath them.

## Architecture

### `db` stays a leaf; entity modules type their own tables via augmentation

Dexie's showcase idiom declares typed `Table` properties on the subclass
(`appointments!: EntityTable<Appointment,'id'>`) — but that would make `db`
**import every entity type**, a cycle that breaks two CLAUDE.md invariants:
"`db` holds store names/indexes only, no entity types — each entity module owns
its own type," and "`db` is a leaf."

**Fix — module augmentation**, the same pattern the codebase already uses for
i18n's `TranslationKeys` and the router's `Register`. `db` declares the schema
with store-name **literals** and an empty, augmentable `WhenAgainDB` interface;
each entity module contributes its own typed table through
`declare module '../db'`. The type edge points **entity → `db`** (the direction
that already exists) — `db` imports no entity type and stays a leaf — while
consumers still get the fully-typed, autocompleting `getDb().appointments`.

```ts
// db/db.ts — leaf: imports only `dexie`, knows zero entity types
import Dexie from 'dexie';

// Augmentation target — each entity module adds its table (see below).
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface WhenAgainDB {}
export class WhenAgainDB extends Dexie {
  constructor() {
    super('when-again');
    this.version(1).stores({
      clients: 'id',
      appointments: 'id, clientId, start.dateTime',
      settings: 'id',
      received: 'id',
    });
  }
}

let db: WhenAgainDB | null = null;
export function getDb(): WhenAgainDB {
  return (db ??= new WhenAgainDB());
}
```

- **No exported `STORE_*` / `INDEX_*` constants.** Under `idb` those deduped a
  store/index name repeated across many call sites in each module; under Dexie
  each name appears once (the schema literal) or is replaced by a keyPath in a
  `.where()` clause, so the constants are pure ceremony. Store names are plain
  literals in the schema; index names disappear entirely (queries reference the
  keyPath, e.g. `.where('clientId')`).
- `id` is the **primary keyPath** for every store (not `++id` — ids come from
  `crypto.randomUUID()` / the `'singleton'` settings id; Dexie must not
  auto-generate).
- `appointments` declares two secondary indexes by keyPath: `clientId` and the
  compound `start.dateTime`.
- `getDb()` is a **plain lazy singleton** returned **synchronously** (Dexie
  opens on first operation). The hand-rolled async liveness/reconnect probe is
  **deleted** — Dexie owns connection lifecycle, auto-reopen, and
  `blocked`/`versionchange` handling.

### Entity modules — typed tables, same public API

Every entity module keeps its **exact public API** (names, signatures, return
types unchanged) — only internals swap. The module owns its type *and*
contributes its table to `db` via augmentation; the `as` casts disappear:

```ts
// appointments/appointments.ts
import { type EntityTable } from 'dexie';
import { getDb } from '../db';

export interface Appointment { id: string; clientId: string; /* … */ }

declare module '../db' {
  interface WhenAgainDB {
    appointments: EntityTable<Appointment, 'id'>;
  }
}

export async function getAppointment(id: string) {
  return getDb().appointments.get(id);          // typed, no cast
}
export async function listAppointmentsOnDate(date: string) {
  return getDb().appointments
    .where('start.dateTime')
    .between(`${date}T00:00`, `${date}T23:59`, true, true)
    .sortBy('start.dateTime');                  // replaces IDBKeyRange + manual JS sort
}
export async function listAppointmentsByClient(clientId: string) {
  return getDb().appointments.where('clientId').equals(clientId).sortBy('start.dateTime');
}
export async function addAppointment(data: Omit<Appointment, 'id'>) {
  const appointment = { id: crypto.randomUUID(), ...data };
  await getDb().appointments.add(appointment);
  return appointment;
}
```

`replaceAll*` becomes `clear()` + `bulkPut()` inside a transaction (the manual
`tx.store` loop is gone). Same treatment for `clients`, `settings` (the
`'singleton'`-keyed record), and `received`. Public signatures are preserved so
**no consumer of an entity module changes because of the table swap** — the
only consumer churn is the reactive-read swap below.

**Locale-sort trap (do NOT "clean up"):** `listClients` sorts with
`name.localeCompare` — correct for Cyrillic/BG. Dexie's `.orderBy()` uses
IndexedDB's **binary** collation, which is *not* locale-correct, so `listClients`
**keeps its JS `localeCompare` sort** (fetch, then sort). Only `start.dateTime`
sorting moves to `.sortBy()` — ISO strings sort identically under binary
collation.

### Reactive reads — `useLiveQuery` replaces react-query

UI modules keep owning their query hooks (as today); only the primitive swaps.
`useLiveQuery` returns the value directly (or `undefined` while loading), not
`{ data, isLoading }`:

```ts
// schedule/queries.ts
import { useLiveQuery } from 'dexie-react-hooks';
export function useDayAppointments(dateKey: string) {
  return useLiveQuery(() => listAppointmentsOnDate(dateKey), [dateKey]);
}
```

Call sites change from `const { data: x } = useX()` to `const x = useX()`, and
loading checks become `x === undefined`. Reactivity is automatic and DB-wide:
any write to a table re-runs every live query that read it, **regardless of
which module issued the write** — no query keys, no invalidation.

**Module-boundary rule (written into CLAUDE.md):**

- `dexie` (the engine: `Dexie`, `Table`, `transaction`) → **data-layer
  modules only** (`db` + the five entity modules).
- `dexie-react-hooks` (`useLiveQuery`) → **allowed in UI modules**, exactly as
  `@tanstack/react-query`'s `useQuery` was — it is the reactive read
  primitive, the React glue, not the DB engine.

### What disappears — the payoff

The migration is subtractive where it matters most:

- **The `['appointment', id]` cache-shape coupling** between `ShareLanding`
  and `AppointmentForm` — the byte-for-byte shape matching, the
  `AppointmentCacheEntry` type, the whole explanatory comment block — **gone**.
  Each component runs its own live closure returning exactly the shape it
  wants; there is no shared key-cache to collide on.
- **The optimistic `setQueryData` cancel-flash dance** in `mutations.ts` —
  gone. Cancel does `updateAppointment({ ...appt, status: 'cancelled' })`; the
  live query re-reads the cancelled status on the next tick.
- **Every `invalidateQueries` call** — gone. `booking/mutations.ts` collapses:
  the mutation hooks become thin wrappers over the entity functions (or are
  inlined at the call site) with no react-query. Booking submit keeps its
  "return the new id then navigate" behaviour via `const appt = await
  addAppointment(data)`.
- **`app/queryClient.ts` and the `<QueryClientProvider>`** in `main.tsx` —
  removed. `@tanstack/react-query` leaves `package.json`.
- **The classify-flash gate** in `ImportScreen` stays but simplifies:
  `stored === undefined` *is* the loading state.

### Backup — atomic replace

`importBackup` wraps its three store replacements in one Dexie transaction, so
an import is all-or-nothing:

```ts
await getDb().transaction('rw', [clientsTable, appointmentsTable, settingsTable],
  async () => { await replaceSettings(...); await replaceAllClients(...); await replaceAllAppointments(...); });
```

This also resolves parked Epic-3 deferred decision #1 (per-record validation
already lives in `parseBackup`; the write is now atomic). Backup JSON format
(`{ app, version, exportedAt, settings, clients, appointments }`) and
wall-clock semantics are unchanged.

## Removed idb-era cruft

Beyond the headline `as`-casts and react-query, the migration deletes
machinery that only existed to work around `idb`:

- **`STORE_*` name constants** and their exports — store name appears once, in
  the schema literal.
- **`INDEX_APPOINTMENTS_BY_CLIENT` / `INDEX_APPOINTMENTS_BY_DATETIME`** — idb
  needed named indexes for `getAllFromIndex`; Dexie queries by keyPath, so the
  index names vanish along with the constants.
- **The `getDb()` liveness/reconnect probe** (~55 lines: transaction-probe,
  `dbPromise` race guard, `terminated`/`close` listeners) — Dexie owns this.
- **`getDb()`'s async-ness** — drop `await` at all 17 call sites; the handle is
  acquired synchronously (DB *operations* stay async).
- **`closeDb()`** — currently exported but called nowhere; deleted (not
  re-exported).
- **`destroyDb()` internals** — the manual `indexedDB.deleteDatabase` +
  `onsuccess`/`onblocked` promise wrapper becomes `Dexie.delete('when-again')`.
- **`replaceAll*` transaction loop** — `tx.store.clear(); for…put; tx.done`
  becomes `clear()` + `bulkPut()`.
- **The v1→v2 `upgrade(db, oldVersion)` callback** — no migration ceremony;
  the schema declares the current shape directly.
- **Most of `db.test.ts`** — the `memoizes the connection`, `persists across
  close and reopen`, `concurrent getDb calls after close`, and v1→v2 migration
  tests all exercised the hand-rolled probe / migration that no longer exist.
  They test Dexie's job, not ours — deleted, not ported. What survives: a
  schema/round-trip check and `requestPersistentStorage`.

## Affected files

**Data layer (internals rewritten, public API preserved):**

- `db/db.ts`, `db/index.ts` — Dexie subclass + augmentable `WhenAgainDB`
  interface + synchronous singleton `getDb()`; drop the liveness probe,
  `STORE_*`/`INDEX_*` constants, and `closeDb`. `destroyDb` →
  `Dexie.delete('when-again')`; `requestPersistentStorage` unchanged.
- `appointments/appointments.ts`, `clients/clients.ts`, `settings/settings.ts`,
  `received/received.ts` — `declare module '../db'` table augmentation, typed
  reads (drop `as`), Dexie query operators, `bulkPut` transactions for
  `replaceAll*`. `clients` keeps its JS `localeCompare` sort.
- `backup/backup.ts` — atomic import transaction.
- `db/db.test.ts` + entity-module tests — prune probe/migration tests; update
  internal assertions to the Dexie surface.

**Reactive-read swap (react-query → `useLiveQuery`):**

- `schedule/queries.ts` — `useDayAppointments`, `useAllClients`,
  `useProviderSettings` → `useLiveQuery`; return type becomes `T | undefined`.
- `booking/mutations.ts` — remove react-query; thin wrappers / direct calls.
- `booking/ShareLanding.tsx`, `booking/MonthPicker.tsx`,
  `booking/AppointmentForm.tsx` — swap `useQuery` → `useLiveQuery`; drop the
  cache-shape comments; adjust destructuring + loading checks.
- `handoff/ImportScreen.tsx` — swap `useQuery`/`invalidateQueries` →
  `useLiveQuery`; loading gate on `undefined`.

**Composition root:**

- `app/main.tsx` — remove `<QueryClientProvider>`.
- `app/queryClient.ts` — **deleted**.

**Deps:** add `dexie`, `dexie-react-hooks`; remove `idb`,
`@tanstack/react-query`.

## Testing

- Unit tests stay on `fake-indexeddb`. Entity-module tests need minimal change
  since public APIs are stable; internal assertions that reached through
  `getDb()`/`idb` primitives are updated to the Dexie surface.
- e2e (`Playwright`) unchanged — no behaviour change. The full booking →
  share → import round-trip remains the integration guard.
- No seeded-v2 migration test (per scope).
- Reactive behaviour gets at least one focused unit/e2e assertion: a write to
  a table updates a mounted `useLiveQuery` reader without any explicit
  invalidation.

## Bundle size

`idb` (~1KB gzip) → `dexie` (~22–24KB gzip); `@tanstack/react-query` is
removed, partially offsetting the delta. Measured before/after recorded in the
PR. Accepted: for an offline-first installed PWA the service worker caches the
bundle once.

## Existing on-device DB (informational, not a requirement)

Dexie multiplies its declared version by 10, so `this.version(1)` opens
IndexedDB at integer version **10**; the installed `idb`-built DB is at integer
**2**. On first open after deploy Dexie runs one `versionchange` upgrade that
preserves every record (object stores keep primary keyPath `id`) and rebuilds
the secondary indexes under Dexie's names (`clientId`, `start.dateTime`) from
the existing rows. This happens automatically and non-destructively — it is a
free safety net, **not** something this epic designs around or tests. Fallback
if ever needed: clear site data once.

## Modulith constraints

- No `dexie` import outside the data-layer modules (`db` + 5 entity modules).
- `dexie-react-hooks` permitted in UI modules only.
- `db` stays a leaf (no entity-type imports); dependency graph stays acyclic.
- Entity-module public APIs unchanged.

## Acceptance criteria

- All existing unit + e2e green; no user-facing behaviour change.
- No `as` casts for entity reads (tables typed via `declare module '../db'`
  augmentation).
- Local reads are reactive via `useLiveQuery` with **no** manual invalidation;
  `@tanstack/react-query` removed from the repo and `package.json`.
- `importBackup` is atomic; backup JSON format + wall-clock semantics
  unchanged.
- Bundle-size delta measured and recorded in the PR.
- typecheck / ESLint / Prettier `format:check` clean; modulith boundaries
  intact (no `dexie` outside data modules; graph acyclic); CLAUDE.md updated
  with the Dexie boundary rule.
