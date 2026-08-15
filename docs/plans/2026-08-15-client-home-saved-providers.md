# Client Home & Saved Providers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Epic #7 sub-project 2 — big-card client home with countdown, saved-provider records (auto-upserted on import, grouped by a minted provider id carried in the handoff payload), a saved-providers tab, and the deferred a11y batch.

**Architecture:** New leaf-ish entity module `savedProviders` (Dexie table + synthetic-key fallback, ADR-0002); the handoff codec gains two optional `v:1` wire fields (`k` provider id, `f` phone); the import flow writes saved provider + received appointment in one transaction; the client shell gets a big-card `ClientHome` (minute-ticking now) and a `ProvidersScreen` under a new `_client` pathless layout.

**Tech Stack:** React + TanStack Router (file-based routes, generated `routeTree.gen.ts`), Dexie + `dexie-react-hooks` (`useLiveQuery`), Tailwind v4 utilities-in-JSX, Vitest + fake-indexeddb, Playwright.

**Spec:** `docs/specs/2026-08-15-client-home-saved-providers-design.md`. Glossary: `CONTEXT.md` ("Saved provider"). Rationale: `docs/adr/0002-provider-identity-in-handoff-payload.md`.

## Global Constraints

- Cross-module imports go through the target module's `index.ts` only; dependency graph stays acyclic. `dexie` is imported only in `db` + entity modules; cross-table transactions import the `db` **object** (the `backup` pattern).
- All user-facing strings via `i18n` `t()`, per-module `strings.ts`, EN + BG (BG is a draft pending the native-speaker pass), each key added to the `TranslationKeys` augmentation. Simplified Technical English for copy.
- Tailwind v4 utilities in JSX; design tokens only (`text-ink`, `bg-surface`, `border-line`, `text-faint`, `text-accent`, `rounded-card`, …); **no `dark:` variants**; tap targets ≥ 44px (`min-h-11`).
- Never hardcode `/when-again/` in app code (`import.meta.env.BASE_URL`); e2e files may.
- Appointments/visits are wall-clock strings `'YYYY-MM-DDTHH:mm'` — naive comparison, **no timezone conversion** (label semantics).
- After adding/renaming route files run `npx vite build` to regenerate `src/app/routeTree.gen.ts` (committed, prettierignored) BEFORE `tsc`-based checks — `npm run build` runs `tsc` first and chicken-and-eggs on a stale tree.
- Gates before every commit: `npx vitest run` (all unit), `npm run lint`, `npm run format:check`. e2e (`npx playwright test`) at Tasks 6 and 8 minimum.
- Commit messages: conventional prefix, **never** include a Claude session link; "Generated with Claude Code" attribution is fine.

---

### Task 1: `savedProviders` entity module + `received.providerId`

**Files:**
- Create: `src/modules/savedProviders/savedProviders.ts`
- Create: `src/modules/savedProviders/index.ts`
- Create: `src/modules/savedProviders/savedProviders.test.ts`
- Modify: `src/modules/received/received.ts` (add `providerId?` to the interface, ~line 10-18)
- Modify: `src/app/main.tsx` (register visitor, after `defineReceivedStore(db)`)
- Modify: `src/test/setup-db.ts` (register visitor)

**Interfaces:**
- Consumes: `db` object from `../db`; `WhenAgainDB` augmentation mechanism.
- Produces: `SavedProvider { id: string; name: string; address?: string; phone?: string }`; `defineSavedProvidersStore(db: Dexie): void`; `syntheticProviderId(name: string): string`; `getSavedProvider(id: string): Promise<SavedProvider | undefined>`; `upsertSavedProvider(provider: SavedProvider): Promise<void>`; `listSavedProviders(): Promise<SavedProvider[]>` (name-sorted, `localeCompare`); `deleteSavedProviderWithVisits(id: string): Promise<void>`. `ReceivedAppointment` gains `providerId?: string`.

- [ ] **Step 1: Write the failing tests**

`src/modules/savedProviders/savedProviders.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { db, getDataVersion } from '../db';
import { upsertReceived, listReceived } from '../received';
import {
  deleteSavedProviderWithVisits,
  getSavedProvider,
  listSavedProviders,
  syntheticProviderId,
  upsertSavedProvider,
  type SavedProvider,
} from './savedProviders';

const maria: SavedProvider = {
  id: 'prov-1',
  name: 'Студио Мария',
  address: 'ул. Роза 5',
  phone: '+359 88 123 4567',
};

function visit(id: string, providerId: string | undefined, dateTime: string) {
  return {
    id,
    providerName: 'Студио Мария',
    service: 'Подстригване',
    start: { dateTime, timeZone: 'Europe/Sofia' },
    durationMinutes: 30,
    status: 'booked' as const,
    ...(providerId ? { providerId } : {}),
  };
}

describe('savedProviders store', () => {
  it('round-trips a record', async () => {
    await upsertSavedProvider(maria);
    expect(await getSavedProvider('prov-1')).toEqual(maria);
  });

  it('upsert overwrites attributes wholesale (healing)', async () => {
    await upsertSavedProvider(maria);
    await upsertSavedProvider({ id: 'prov-1', name: 'Студио Мария ✂️' });
    const stored = await getSavedProvider('prov-1');
    expect(stored?.name).toBe('Студио Мария ✂️');
    expect(stored?.phone).toBeUndefined(); // absent attribute clears
  });

  it('lists sorted by name with localeCompare (Cyrillic-correct)', async () => {
    await upsertSavedProvider({ id: 'b', name: 'Ясен' });
    await upsertSavedProvider({ id: 'a', name: 'Ася' });
    const names = (await listSavedProviders()).map((p) => p.name);
    expect(names).toEqual(['Ася', 'Ясен']);
  });

  it('bumps the shared schema to version 2 (native 20)', async () => {
    expect(await getDataVersion()).toBe(20);
  });
});

describe('syntheticProviderId', () => {
  it('normalizes: trim, collapse whitespace, lowercase', () => {
    expect(syntheticProviderId('  Студио   МАРИЯ ')).toBe(
      'name:студио мария',
    );
    expect(syntheticProviderId('Studio M')).toBe('name:studio m');
  });
});

describe('deleteSavedProviderWithVisits', () => {
  it('removes the record and only its visits, atomically', async () => {
    await upsertSavedProvider(maria);
    await upsertSavedProvider({ id: 'prov-2', name: 'Друг салон' });
    await upsertReceived(visit('v1', 'prov-1', '2026-09-01T10:00'));
    await upsertReceived(visit('v2', 'prov-1', '2026-09-08T10:00'));
    await upsertReceived(visit('v3', 'prov-2', '2026-09-02T12:00'));
    await upsertReceived(visit('v4', undefined, '2026-09-03T12:00')); // legacy, no providerId

    await deleteSavedProviderWithVisits('prov-1');

    expect(await getSavedProvider('prov-1')).toBeUndefined();
    expect(await getSavedProvider('prov-2')).toBeDefined();
    const remaining = (await listReceived()).map((v) => v.id).sort();
    expect(remaining).toEqual(['v3', 'v4']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/modules/savedProviders`
Expected: FAIL — cannot resolve `./savedProviders` (module does not exist).

- [ ] **Step 3: Implement the module**

`src/modules/savedProviders/savedProviders.ts`:

```ts
import Dexie, { type EntityTable } from 'dexie';
import { db } from '../db';

// The client's saved record of a provider (CONTEXT.md "Saved provider",
// ADR-0002). Identity is the provider's minted id carried in the handoff
// payload; name/address/phone are attributes overwritten wholesale by each
// import, so a provider rename heals the client's grouping retroactively.
export interface SavedProvider {
  id: string;
  name: string;
  address?: string;
  phone?: string;
}

declare module '../db' {
  interface WhenAgainDB {
    savedProviders: EntityTable<SavedProvider, 'id'>;
  }
}

export function defineSavedProvidersStore(db: Dexie): void {
  // Version 2 of the shared schema sequence adds this table. Dexie carries
  // every version-1 store forward, so the other entity modules keep their
  // v1 lines untouched.
  db.version(2).stores({ savedProviders: 'id' });
}

// Grouping key for payloads that predate the minted id (ADR-0002): derived
// from the normalized provider name so import's auto-upsert works uniformly.
export function syntheticProviderId(name: string): string {
  return `name:${name.trim().replace(/\s+/g, ' ').toLowerCase()}`;
}

export async function getSavedProvider(
  id: string,
): Promise<SavedProvider | undefined> {
  return db.savedProviders.get(id);
}

export async function upsertSavedProvider(
  provider: SavedProvider,
): Promise<void> {
  await db.savedProviders.put(provider);
}

// JS sort, not Dexie .orderBy: IndexedDB collation is binary, wrong for
// Cyrillic (same reason listClients sorts in JS).
export async function listSavedProviders(): Promise<SavedProvider[]> {
  const all = await db.savedProviders.toArray();
  return all.sort((a, b) => a.name.localeCompare(b.name));
}

// Deleting a saved provider removes its received visits too (spec: one
// confirm, both gone). `providerId` is not indexed — a client's dataset is
// dozens of rows — so filter in JS inside one rw transaction (the backup
// pattern: cross-table work goes through the db object).
export async function deleteSavedProviderWithVisits(id: string): Promise<void> {
  await db.transaction('rw', db.savedProviders, db.received, async () => {
    const visitIds = (await db.received.toArray())
      .filter((visit) => visit.providerId === id)
      .map((visit) => visit.id);
    await db.received.bulkDelete(visitIds);
    await db.savedProviders.delete(id);
  });
}
```

`src/modules/savedProviders/index.ts`:

```ts
export {
  defineSavedProvidersStore,
  deleteSavedProviderWithVisits,
  getSavedProvider,
  listSavedProviders,
  syntheticProviderId,
  upsertSavedProvider,
} from './savedProviders';
export type { SavedProvider } from './savedProviders';
```

In `src/modules/received/received.ts`, add to `ReceivedAppointment` (after `providerName`):

```ts
  /**
   * Grouping key → savedProviders.id (minted id from the payload, or the
   * synthetic name key for payloads that predate it — ADR-0002). Absent on
   * rows imported before #7 sub-project 2. Not indexed.
   */
  providerId?: string;
```

In `src/test/setup-db.ts`, add import and registration (alongside the existing four):

```ts
import { defineSavedProvidersStore } from '../modules/savedProviders';
// ...
defineSavedProvidersStore(db);
```

In `src/app/main.tsx` `bootstrap()`, same two lines (import at top, call after `defineReceivedStore(db)`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/modules/savedProviders src/modules/received`
Expected: PASS (received's existing tests still green — `providerId` is optional).

- [ ] **Step 5: Gates + commit**

Run: `npx vitest run && npm run lint && npm run format:check`

```bash
git add src/modules/savedProviders src/modules/received/received.ts src/app/main.tsx src/test/setup-db.ts
git commit -m "feat: savedProviders entity module + received.providerId (#7)"
```

---

### Task 2: codec `k`/`f` wire fields + classify compares `providerId`

**Files:**
- Modify: `src/modules/handoff/codec.ts`
- Modify: `src/modules/handoff/codec.test.ts`
- Modify: `src/modules/handoff/classify.ts` (`sameFields`)
- Modify: `src/modules/handoff/classify.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `HandoffInput` gains `providerId?: string; phone?: string`. `DecodeResult` ok-branch becomes `{ ok: true; appointment: ReceivedAppointment; provider: { id?: string; phone?: string } }` (the appointment does NOT carry `providerId` out of the codec — the import flow assigns it, Task 4). `classifyImport` unchanged in signature; `sameFields` now also compares `providerId`.

- [ ] **Step 1: Write the failing tests**

Add to `src/modules/handoff/codec.test.ts` (follow the file's existing fixture style):

```ts
it('round-trips providerId and phone via k/f', () => {
  const encoded = encodeHandoff({
    id: 'a1',
    providerName: 'Студио Мария',
    service: 'Подстригване',
    start: { dateTime: '2026-09-01T15:00', timeZone: 'Europe/Sofia' },
    durationMinutes: 30,
    status: 'booked',
    providerId: 'prov-1',
    phone: '+359 88 123 4567',
  });
  const decoded = decodeHandoff(encoded);
  expect(decoded.ok).toBe(true);
  if (!decoded.ok) return;
  expect(decoded.provider).toEqual({
    id: 'prov-1',
    phone: '+359 88 123 4567',
  });
  expect('providerId' in decoded.appointment).toBe(false);
});

it('decodes a payload without k/f (pre-field payloads stay valid)', () => {
  const encoded = encodeHandoff({
    id: 'a1',
    providerName: 'Студио Мария',
    service: 'Подстригване',
    start: { dateTime: '2026-09-01T15:00', timeZone: 'Europe/Sofia' },
    durationMinutes: 30,
    status: 'booked',
  });
  const decoded = decodeHandoff(encoded);
  expect(decoded.ok).toBe(true);
  if (!decoded.ok) return;
  expect(decoded.provider).toEqual({});
});

it('rejects a non-string k or f as malformed', () => {
  const wire = {
    v: 1, i: 'a1', p: 'X', s: 'Y',
    t: '2026-09-01T15:00', z: 'Europe/Sofia', d: 30, c: 0, k: 7,
  };
  const fragment = btoa(
    String.fromCharCode(...new TextEncoder().encode(JSON.stringify(wire))),
  )
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  expect(decodeHandoff(fragment)).toEqual({ ok: false, reason: 'malformed' });
});
```

Add to `src/modules/handoff/classify.test.ts`:

```ts
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
```

(If `classify.test.ts` has no fixture builder named `base`, reuse whatever
complete-`ReceivedAppointment` literal the file already uses.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/modules/handoff`
Expected: FAIL — `providerId` not in `HandoffInput`, `provider` not on `DecodeResult`, classify returns `upToDate` for the self-heal case.

- [ ] **Step 3: Implement**

In `codec.ts` — `HandoffInput` gains (after `status`):

```ts
  /** Minted provider identity (ADR-0002). Optional: absent pre-#7 payloads. */
  providerId?: string;
  /** Provider phone, free-text as entered in Settings → Profile. */
  phone?: string;
```

`Wire` gains `k?: string; f?: string;` (comment: `// k: provider id, f: phone — optional, added by #7 sub-project 2; decode ignores unknown keys, so these are v:1-compatible both directions (ADR-0002)`).

`encodeHandoff` wire literal gains:

```ts
    ...(input.providerId ? { k: input.providerId } : {}),
    ...(input.phone ? { f: input.phone } : {}),
```

`DecodeResult`:

```ts
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
```

Validation block gains two clauses (alongside the `d.a` one):

```ts
    (d.k !== undefined && !isStr(d.k)) ||
    (d.f !== undefined && !isStr(d.f))
```

Success return gains:

```ts
    provider: {
      ...(isStr(d.k) && d.k ? { id: d.k } : {}),
      ...(isStr(d.f) && d.f ? { phone: d.f } : {}),
    },
```

In `classify.ts` `sameFields`, add `a.providerId === b.providerId &&` with the comment:

```ts
    // providerId included deliberately: a stored row imported before the
    // minted id (#7) differs from the enriched incoming one exactly once —
    // the resulting "changed" → update writes the id (self-heal, ADR-0002).
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/modules/handoff`
Expected: PASS, including all pre-existing codec/classify tests.

- [ ] **Step 5: Gates + commit**

Run: `npx vitest run && npm run lint && npm run format:check`

```bash
git add src/modules/handoff/codec.ts src/modules/handoff/codec.test.ts src/modules/handoff/classify.ts src/modules/handoff/classify.test.ts
git commit -m "feat: handoff payload carries provider id and phone (k/f, ADR-0002)"
```

---

### Task 3: settings `providerId`/`phone`, profile phone field, share side

**Files:**
- Modify: `src/modules/settings/settings.ts`, `src/modules/settings/index.ts`
- Modify: `src/modules/settings/settings.test.ts`
- Modify: `src/modules/shell/SettingsScreen.tsx` (ProfileSection)
- Modify: `src/modules/shell/strings.ts` (+1 key)
- Modify: `src/modules/handoff/HandoffShare.tsx` (new props)
- Modify: `src/modules/booking/ShareLanding.tsx` (mint effect + pass props)

**Interfaces:**
- Consumes: `updateSettings`, `getSettings` (existing); `HandoffInput.providerId/phone` (Task 2).
- Produces: `Settings` gains `providerId: string | null` (in `DEFAULT_SETTINGS`: `null`) and `phone?: string`. New export `ensureProviderId(): Promise<string>`. `HandoffShare` props gain `providerId?: string; phone?: string`. New string key `shell.settings.profile.phone`.

- [ ] **Step 1: Write the failing tests**

Add to `src/modules/settings/settings.test.ts`:

```ts
import { ensureProviderId } from './settings';

describe('ensureProviderId', () => {
  it('mints a uuid once and returns the same id forever after', async () => {
    const first = await ensureProviderId();
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    const second = await ensureProviderId();
    expect(second).toBe(first);
    expect((await getSettings()).providerId).toBe(first);
  });

  it('defaults to null on a fresh profile', async () => {
    expect((await getSettings()).providerId).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/modules/settings`
Expected: FAIL — `ensureProviderId` not exported / `providerId` missing.

- [ ] **Step 3: Implement settings**

In `settings.ts`, `Settings` gains (after `address`):

```ts
  /** Provider phone, shown to clients on their next-visit card (#7). */
  phone?: string;
  /**
   * Minted provider identity carried in every handoff payload (ADR-0002).
   * Created lazily by ensureProviderId() on first share; never regenerated —
   * this id IS the provider's identity on client devices.
   */
  providerId: string | null;
```

`DEFAULT_SETTINGS` gains `providerId: null,`. Add:

```ts
export async function ensureProviderId(): Promise<string> {
  const current = await getSettings();
  if (current.providerId) return current.providerId;
  const id = crypto.randomUUID();
  await updateSettings({ providerId: id });
  return id;
}
```

Export `ensureProviderId` from `src/modules/settings/index.ts`. (Old backups
without the field import cleanly: `getSettings` spreads stored over
`DEFAULT_SETTINGS`, and `parseBackup` only shape-checks `settings` as a
non-array object.)

- [ ] **Step 4: Profile phone field**

In `SettingsScreen.tsx` `ProfileSection`: add `initialPhone: string` prop and
`const [phone, setPhone] = useState(initialPhone);`, a third labelled input
between address and the save button (same classes as the address input):

```tsx
      <label className="text-ink flex flex-col gap-1 text-sm">
        {t('shell.settings.profile.phone')}
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          type="tel"
          data-testid="profile-phone"
          className="border-line bg-surface text-ink rounded-card min-h-11 border px-3"
        />
      </label>
```

`save` becomes:

```ts
    await updateSettings({
      providerName: name,
      address: address || undefined,
      phone: phone || undefined,
    });
```

At the call site, the remount `key` must include phone (it exists to resync
after an external change, e.g. backup import):

```tsx
        <ProfileSection
          key={`${settings.providerName}|${settings.address ?? ''}|${settings.phone ?? ''}`}
          initialName={settings.providerName}
          initialAddress={settings.address ?? ''}
          initialPhone={settings.phone ?? ''}
          ...
```

In `strings.ts` add to both languages + `TranslationKeys`:

```ts
  'shell.settings.profile.phone': 'Phone',        // en
  'shell.settings.profile.phone': 'Телефон',      // bg
```

- [ ] **Step 5: Share side**

`HandoffShare.tsx` props gain `providerId?: string; phone?: string`, and the
`buildHandoffUrl` input gains:

```ts
      ...(providerId ? { providerId } : {}),
      ...(phone ? { phone } : {}),
```

`ShareLanding.tsx`: add near the top of the component (with `useEffect`
imported from react):

```ts
  // Mint the provider identity the first time a handoff is built (ADR-0002).
  // The settings live query picks the new id up reactively; the QR without
  // `k` exists for a single render frame at worst — not scannable by a human.
  useEffect(() => {
    void ensureProviderId();
  }, []);
```

and pass the new props where `HandoffShare` is rendered:

```tsx
          <HandoffShare
            appointment={appointment}
            providerName={settings?.providerName ?? ''}
            address={settings?.address}
            providerId={settings?.providerId ?? undefined}
            phone={settings?.phone}
          />
```

(`ensureProviderId` comes from `'../settings'` — booking already imports that
module's public API.)

- [ ] **Step 6: Run tests, gates, commit**

Run: `npx vitest run && npm run lint && npm run format:check`
Expected: all green, including the shell strings-parity test picking up the new key.

```bash
git add src/modules/settings src/modules/shell/SettingsScreen.tsx src/modules/shell/strings.ts src/modules/handoff/HandoffShare.tsx src/modules/booking/ShareLanding.tsx
git commit -m "feat: provider identity + phone in profile and handoff share (#7)"
```

---

### Task 4: import writes the saved provider

**Files:**
- Create: `src/modules/handoff/importWrite.ts`
- Create: `src/modules/handoff/importWrite.test.ts`
- Modify: `src/modules/handoff/ImportScreen.tsx`

**Interfaces:**
- Consumes: `syntheticProviderId`, `upsertSavedProvider` (Task 1, via `'../savedProviders'` index); `db` object; `decoded.provider` (Task 2).
- Produces: `enrichWithProviderKey(appointment: ReceivedAppointment, providerId?: string): ReceivedAppointment` (returns a copy with `providerId` always set); `applyHandoffImport(appointment: ReceivedAppointment, phone?: string): Promise<void>`. Module edge `handoff → savedProviders` (acyclic: savedProviders imports nothing above `db`).

- [ ] **Step 1: Write the failing tests**

`src/modules/handoff/importWrite.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getReceived, listReceived, upsertReceived } from '../received';
import { getSavedProvider, listSavedProviders } from '../savedProviders';
import { applyHandoffImport, enrichWithProviderKey } from './importWrite';

const appt = (over: object = {}) => ({
  id: 'a1',
  providerName: 'Студио Мария',
  address: 'ул. Роза 5',
  service: 'Подстригване',
  start: { dateTime: '2026-09-01T15:00', timeZone: 'Europe/Sofia' },
  durationMinutes: 30,
  status: 'booked' as const,
  ...over,
});

describe('enrichWithProviderKey', () => {
  it('uses the payload id when present', () => {
    expect(enrichWithProviderKey(appt(), 'prov-1').providerId).toBe('prov-1');
  });
  it('falls back to the synthetic name key', () => {
    expect(enrichWithProviderKey(appt()).providerId).toBe(
      'name:студио мария',
    );
  });
});

describe('applyHandoffImport', () => {
  it('writes saved provider and received row, linked', async () => {
    const incoming = enrichWithProviderKey(appt(), 'prov-1');
    await applyHandoffImport(incoming, '+359 88 123 4567');
    expect(await getSavedProvider('prov-1')).toEqual({
      id: 'prov-1',
      name: 'Студио Мария',
      address: 'ул. Роза 5',
      phone: '+359 88 123 4567',
    });
    expect((await getReceived('a1'))?.providerId).toBe('prov-1');
  });

  it('is idempotent: re-import leaves exactly one of each', async () => {
    const incoming = enrichWithProviderKey(appt(), 'prov-1');
    await applyHandoffImport(incoming, undefined);
    await applyHandoffImport(incoming, undefined);
    expect((await listReceived()).length).toBe(1);
    expect((await listSavedProviders()).length).toBe(1);
  });

  it('heals attributes on re-import (rename + new phone)', async () => {
    await applyHandoffImport(enrichWithProviderKey(appt(), 'prov-1'));
    await applyHandoffImport(
      enrichWithProviderKey(appt({ providerName: 'Студио Мария ✂️' }), 'prov-1'),
      '+359 88 000 0000',
    );
    const stored = await getSavedProvider('prov-1');
    expect(stored?.name).toBe('Студио Мария ✂️');
    expect(stored?.phone).toBe('+359 88 000 0000');
    expect((await listSavedProviders()).length).toBe(1);
  });

  it('id-less payloads group under the synthetic record', async () => {
    await applyHandoffImport(enrichWithProviderKey(appt()));
    const stored = await getSavedProvider('name:студио мария');
    expect(stored?.name).toBe('Студио Мария');
  });

  it('adopts a legacy received row on update (self-heal)', async () => {
    await upsertReceived(appt()); // pre-#7 row, no providerId
    await applyHandoffImport(enrichWithProviderKey(appt(), 'prov-1'));
    expect((await getReceived('a1'))?.providerId).toBe('prov-1');
    expect((await listReceived()).length).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/modules/handoff/importWrite.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `importWrite.ts`**

```ts
import { db } from '../db';
import { type ReceivedAppointment } from '../received';
import { syntheticProviderId, upsertSavedProvider } from '../savedProviders';

// Resolve the grouping key once, before classify: the minted id from the
// payload, or the synthetic name key for payloads that predate it
// (ADR-0002). Classify compares providerId, so a legacy stored row shows
// "changed" exactly once and the update below writes the id.
export function enrichWithProviderKey(
  appointment: ReceivedAppointment,
  providerId?: string,
): ReceivedAppointment {
  return {
    ...appointment,
    providerId: providerId ?? syntheticProviderId(appointment.providerName),
  };
}

// One write path (Epic 6 invariant, extended): a confirmed import upserts
// the saved provider AND the received appointment atomically. Saved-provider
// attributes are overwritten wholesale — each payload is the provider's
// latest word on their own name/address/phone.
export async function applyHandoffImport(
  appointment: ReceivedAppointment,
  phone?: string,
): Promise<void> {
  const key =
    appointment.providerId ?? syntheticProviderId(appointment.providerName);
  await db.transaction('rw', db.savedProviders, db.received, async () => {
    await upsertSavedProvider({
      id: key,
      name: appointment.providerName,
      ...(appointment.address ? { address: appointment.address } : {}),
      ...(phone ? { phone } : {}),
    });
    await db.received.put({ ...appointment, providerId: key });
  });
}
```

(Note: writes `db.received.put` directly rather than `upsertReceived` so the
whole write provably stays inside this transaction; both are the same
operation.)

- [ ] **Step 4: Wire into `ImportScreen.tsx`**

- Import `applyHandoffImport, enrichWithProviderKey` from `'./importWrite'`;
  drop the now-unused `upsertReceived` import (keep `getReceived`).
- After `const decoded = ...`, derive the enriched incoming once:

```ts
  const incoming = decoded?.ok
    ? enrichWithProviderKey(decoded.appointment, decoded.provider.id)
    : null;
```

  Replace the existing `const incoming = decoded.appointment;` and use the
  enriched `incoming` everywhere below (Card, classify, ChangedNote). The
  early-return edge states keep their current order; after them `incoming`
  is non-null — assert with a local non-null narrowing, not `!`.
- `write()` becomes:

```ts
      await applyHandoffImport(incoming, decoded.provider.phone);
      await adoptClientModeIfUnset();
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/modules/handoff`
Expected: PASS.

- [ ] **Step 6: Gates + commit**

Run: `npx vitest run && npm run lint && npm run format:check && npx playwright test e2e/handoff.spec.ts`
Expected: all green — the existing handoff e2e (add / update / cancel round-trip) must still pass unchanged.

```bash
git add src/modules/handoff
git commit -m "feat: import upserts the saved provider alongside the visit (#7)"
```

---

### Task 5: ticking now, countdown, big-card `ClientHome`

**Files:**
- Create: `src/modules/shell/countdown.ts`, `src/modules/shell/countdown.test.ts`
- Create: `src/modules/shell/useTickingNow.ts`
- Create: `src/modules/shell/ClientHome.tsx`
- Delete: `src/modules/shell/ClientVisitsList.tsx`
- Modify: `src/modules/shell/clientVisits.ts` (+`selectNextVisit`), `src/modules/shell/clientVisits.test.ts`
- Modify: `src/modules/shell/index.ts` (export `ClientHome`, drop `ClientVisitsList`)
- Modify: `src/app/routes/index.tsx` (render `ClientHome`)
- Modify: `src/modules/shell/strings.ts` (new keys, drop `shell.clientHome.empty`)
- Modify: `src/modules/i18n/i18n.ts` (cache `Intl.PluralRules` — the parked Epic-2 chore, due now that the first plural string ships) + `src/modules/i18n/i18n.test.ts`

**Interfaces:**
- Consumes: `partitionVisits` (existing), `listReceived`, `listSavedProviders`, `formatDayLabel(dateKey, language)`, `wallClockNow()`, `t()`.
- Produces: `countdownBucket(nowDateTime: string, startDateTime: string): CountdownBucket` where `CountdownBucket = { kind: 'minutes'; minutes: number } | { kind: 'today'; time: string } | { kind: 'tomorrow'; time: string } | { kind: 'days'; days: number }`; `useTickingNow(): string` (a `'YYYY-MM-DDTHH:mm'` string); `selectNextVisit(upcoming: ReceivedAppointment[]): ReceivedAppointment | undefined`; component `ClientHome`. Keeps testids `client-home`, `client-visit` (smoke.spec depends on `client-home`); adds `next-visit-card`, `next-visit-empty`.

- [ ] **Step 1: Write the failing tests**

`src/modules/shell/countdown.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { countdownBucket } from './countdown';

describe('countdownBucket', () => {
  it('under an hour → minutes', () => {
    expect(countdownBucket('2026-09-01T14:20', '2026-09-01T15:00')).toEqual({
      kind: 'minutes',
      minutes: 40,
    });
  });
  it('exactly now → floors at 1 minute', () => {
    expect(countdownBucket('2026-09-01T15:00', '2026-09-01T15:00')).toEqual({
      kind: 'minutes',
      minutes: 1,
    });
  });
  it('across midnight but under an hour → minutes, not tomorrow', () => {
    expect(countdownBucket('2026-09-01T23:30', '2026-09-02T00:15')).toEqual({
      kind: 'minutes',
      minutes: 45,
    });
  });
  it('later the same day → today + time', () => {
    expect(countdownBucket('2026-09-01T08:00', '2026-09-01T15:00')).toEqual({
      kind: 'today',
      time: '15:00',
    });
  });
  it('next calendar day → tomorrow + time', () => {
    expect(countdownBucket('2026-09-01T08:00', '2026-09-02T09:30')).toEqual({
      kind: 'tomorrow',
      time: '09:30',
    });
  });
  it('further out → calendar-day difference', () => {
    expect(countdownBucket('2026-09-01T23:00', '2026-09-04T08:00')).toEqual({
      kind: 'days',
      days: 3,
    });
  });
  it('month boundary days are calendar days, not 24h blocks', () => {
    expect(countdownBucket('2026-08-31T23:50', '2026-09-02T00:10')).toEqual({
      kind: 'days',
      days: 2,
    });
  });
});
```

Add to `src/modules/shell/clientVisits.test.ts`:

```ts
import { selectNextVisit } from './clientVisits';

describe('selectNextVisit', () => {
  it('picks the earliest upcoming non-cancelled visit', () => {
    const upcoming = [
      visit('v1', '2026-09-01T10:00', 'cancelled'),
      visit('v2', '2026-09-02T10:00', 'booked'),
      visit('v3', '2026-09-03T10:00', 'booked'),
    ];
    expect(selectNextVisit(upcoming)?.id).toBe('v2');
  });
  it('returns undefined when everything upcoming is cancelled', () => {
    expect(
      selectNextVisit([visit('v1', '2026-09-01T10:00', 'cancelled')]),
    ).toBeUndefined();
  });
});
```

(Reuse/extend the file's existing visit fixture builder; it already builds
`ReceivedAppointment` literals for `partitionVisits` tests — keep the input
pre-sorted ascending like `partitionVisits` returns.)

Add to `src/modules/i18n/i18n.test.ts` (plural behavior is already covered
there; this pins the caching refactor):

```ts
it('plural selection is stable across repeated calls (cached rules)', () => {
  registerStrings('en', {
    'x.days': { one: 'in {count} day', other: 'in {count} days' },
  });
  initI18n('en');
  expect(t('x.days' as never, { count: 1 })).toBe('in 1 day');
  expect(t('x.days' as never, { count: 3 })).toBe('in 3 days');
  expect(t('x.days' as never, { count: 1 })).toBe('in 1 day');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/modules/shell src/modules/i18n`
Expected: FAIL — `countdown.ts` missing, `selectNextVisit` missing.

- [ ] **Step 3: Implement pure logic**

`src/modules/shell/countdown.ts`:

```ts
export type CountdownBucket =
  | { kind: 'minutes'; minutes: number }
  | { kind: 'today'; time: string }
  | { kind: 'tomorrow'; time: string }
  | { kind: 'days'; days: number };

// Days are compared via Date.UTC on the date parts: immune to DST shifts.
function calendarDayDiff(fromDateKey: string, toDateKey: string): number {
  const [fy, fm, fd] = fromDateKey.split('-').map(Number);
  const [ty, tm, td] = toDateKey.split('-').map(Number);
  return Math.round(
    (Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000,
  );
}

// Humane coarse countdown for the next-visit card (#7). Both arguments are
// wall-clock 'YYYY-MM-DDTHH:mm' strings compared naively on the device
// clock — label semantics, no timezone conversion. `new Date()` parses the
// offset-less ISO form as local time per spec, which is exactly the naive
// comparison wanted here.
export function countdownBucket(
  nowDateTime: string,
  startDateTime: string,
): CountdownBucket {
  const minutes = Math.round(
    (new Date(startDateTime).getTime() - new Date(nowDateTime).getTime()) /
      60_000,
  );
  if (minutes < 60) return { kind: 'minutes', minutes: Math.max(minutes, 1) };
  const time = startDateTime.slice(11, 16);
  const days = calendarDayDiff(
    nowDateTime.slice(0, 10),
    startDateTime.slice(0, 10),
  );
  if (days === 0) return { kind: 'today', time };
  if (days === 1) return { kind: 'tomorrow', time };
  return { kind: 'days', days };
}
```

`src/modules/shell/useTickingNow.ts`:

```ts
import { useEffect, useState } from 'react';
import { wallClockNow } from '../time';

// Minute-grain reactive "now": the home re-renders each minute and on tab
// re-focus, so the countdown and the upcoming/past split never go stale on
// a long-open PWA (the sub-project-1 ClientVisitsList read the clock once
// per render). Minute precision matches the wall-clock format.
export function useTickingNow(): string {
  const [now, setNow] = useState(() => wallClockNow().dateTime);
  useEffect(() => {
    const update = () => setNow(wallClockNow().dateTime);
    const timer = window.setInterval(update, 60_000);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  return now;
}
```

Add to `src/modules/shell/clientVisits.ts`:

```ts
// The big card shows the earliest upcoming non-cancelled visit; cancelled
// upcoming rows still appear in the list below it.
export function selectNextVisit(
  upcoming: ReceivedAppointment[],
): ReceivedAppointment | undefined {
  return upcoming.find((v) => v.status !== 'cancelled');
}
```

In `src/modules/i18n/i18n.ts`, cache the plural rules (parked Epic-2 chore):

```ts
const pluralRulesCache: Partial<Record<Language, Intl.PluralRules>> = {};
```

and in `t()` replace `new Intl.PluralRules(active)` with
`(pluralRulesCache[active] ??= new Intl.PluralRules(active))`, plus the
guard comment on the existing count default:

```ts
  // Plural keys resolve with count 0 ('other') when the caller forgot
  // params.count — documented footgun: plural strings must be called with
  // a count.
```

- [ ] **Step 4: Run logic tests to verify they pass**

Run: `npx vitest run src/modules/shell src/modules/i18n`
Expected: PASS.

- [ ] **Step 5: Build `ClientHome`**

`src/modules/shell/ClientHome.tsx` (replaces `ClientVisitsList.tsx` — delete
that file; `VisitRow`/`VisitGroup` carry over with one change: the resolved
provider name comes in as a prop):

```tsx
import { useLiveQuery } from 'dexie-react-hooks';
import { getActiveLanguage, t } from '../i18n';
import { listReceived, type ReceivedAppointment } from '../received';
import { listSavedProviders } from '../savedProviders';
import { formatDayLabel } from '../schedule';
import { partitionVisits, selectNextVisit } from './clientVisits';
import { countdownBucket } from './countdown';
import { useTickingNow } from './useTickingNow';

function countdownText(now: string, start: string): string {
  const bucket = countdownBucket(now, start);
  switch (bucket.kind) {
    case 'minutes':
      return t('shell.clientHome.inMinutes', { count: bucket.minutes });
    case 'today':
      return t('shell.clientHome.today', { time: bucket.time });
    case 'tomorrow':
      return t('shell.clientHome.tomorrow', { time: bucket.time });
    case 'days':
      return t('shell.clientHome.inDays', { count: bucket.days });
  }
}

function NextVisitCard({
  visit,
  providerName,
  phone,
  now,
}: {
  visit: ReceivedAppointment;
  providerName: string;
  phone?: string;
  now: string;
}) {
  const day = formatDayLabel(
    visit.start.dateTime.slice(0, 10),
    getActiveLanguage(),
  );
  return (
    <section
      data-testid="next-visit-card"
      className="border-line bg-surface rounded-card flex flex-col gap-1.5 border p-4"
    >
      <p className="text-accent text-sm font-semibold">
        {countdownText(now, visit.start.dateTime)}
      </p>
      <p className="text-ink font-display text-2xl">
        {day} · {visit.start.dateTime.slice(11, 16)}
      </p>
      <p className="text-ink font-[550]">{visit.service}</p>
      <p className="text-faint text-sm">{providerName}</p>
      {phone && (
        <a
          href={`tel:${phone}`}
          className="text-accent inline-flex min-h-11 items-center text-sm font-semibold no-underline"
        >
          {t('shell.clientHome.call')}: {phone}
        </a>
      )}
    </section>
  );
}

function EmptyCard() {
  return (
    <section
      data-testid="next-visit-empty"
      className="border-line bg-surface rounded-card flex flex-col gap-1.5 border p-4"
    >
      <p className="text-ink font-[550]">
        {t('shell.clientHome.emptyCard.title')}
      </p>
      <p className="text-faint text-sm">
        {t('shell.clientHome.emptyCard.hint')}
      </p>
    </section>
  );
}

// Big-card client home (#7 sub-project 2): next visit at a glance, then one
// flat chronological stream — remaining upcoming, then past.
export function ClientHome() {
  const now = useTickingNow();
  const items = useLiveQuery(() => listReceived(), []);
  const providers = useLiveQuery(() => listSavedProviders(), []);
  if (items === undefined || providers === undefined) return null;

  const byId = new Map(providers.map((p) => [p.id, p]));
  // Provider identity always displays from the saved record (ADR-0002:
  // attributes heal on import); the row's own snapshot is the fallback.
  const nameOf = (v: ReceivedAppointment) =>
    (v.providerId ? byId.get(v.providerId)?.name : undefined) ??
    v.providerName;

  const { upcoming, past } = partitionVisits(items, now);
  const next = selectNextVisit(upcoming);
  const rest = upcoming.filter((v) => v !== next);
  const nextProvider = next?.providerId ? byId.get(next.providerId) : undefined;

  return (
    <main className="flex flex-col gap-4 p-4" data-testid="client-home">
      <h1 className="text-ink font-display text-xl">
        {t('shell.clientHome.title')}
      </h1>
      {next ? (
        <NextVisitCard
          visit={next}
          providerName={nameOf(next)}
          phone={nextProvider?.phone}
          now={now}
        />
      ) : (
        <EmptyCard />
      )}
      <VisitGroup
        titleKey="shell.clientHome.upcoming"
        visits={rest}
        nameOf={nameOf}
      />
      <VisitGroup
        titleKey="shell.clientHome.past"
        visits={past}
        nameOf={nameOf}
      />
    </main>
  );
}
```

`VisitRow`/`VisitGroup` (in the same file, above `ClientHome`): copy from the
old `ClientVisitsList.tsx` verbatim, except both take
`nameOf: (v: ReceivedAppointment) => string` and `VisitRow` renders
`{nameOf(visit)}` where it rendered `{visit.providerName}`, and the `<ul>`
gains `role="list"` (list-style is stripped, Safari drops list semantics
without it — part of the a11y batch, done here because the file is new):

```tsx
      <ul role="list" className="flex list-none flex-col gap-2 p-0">
```

Update `src/modules/shell/index.ts`: `export { ClientHome } from './ClientHome';`
replacing the `ClientVisitsList` line. In `src/app/routes/index.tsx` swap the
import and render `<ClientHome />` where `<ClientVisitsList />` was.

- [ ] **Step 6: Strings**

In `strings.ts`, **remove** `shell.clientHome.empty` (both languages + the
`TranslationKeys` entry) and add to both blocks + `TranslationKeys`:

```ts
  // en
  'shell.clientHome.inMinutes': 'In {count} min',
  'shell.clientHome.today': 'Today at {time}',
  'shell.clientHome.tomorrow': 'Tomorrow at {time}',
  'shell.clientHome.inDays': { one: 'In {count} day', other: 'In {count} days' },
  'shell.clientHome.call': 'Call',
  'shell.clientHome.emptyCard.title': 'No upcoming visit',
  'shell.clientHome.emptyCard.hint':
    'Scan the QR code at the salon to add your next visit.',
```

```ts
  // bg
  'shell.clientHome.inMinutes': 'След {count} мин',
  'shell.clientHome.today': 'Днес в {time}',
  'shell.clientHome.tomorrow': 'Утре в {time}',
  'shell.clientHome.inDays': { one: 'След {count} ден', other: 'След {count} дни' },
  'shell.clientHome.call': 'Обади се',
  'shell.clientHome.emptyCard.title': 'Няма предстоящ час',
  'shell.clientHome.emptyCard.hint':
    'Сканирайте QR кода в салона, за да добавите следващия си час.',
```

Then `grep -rn "clientHome.empty" src e2e` — update any remaining reference
(e2e asserting the old empty text should assert `next-visit-empty` instead).

- [ ] **Step 7: Run tests, gates, commit**

Run: `npx vitest run && npm run lint && npm run format:check && npx playwright test`
Expected: all green (smoke.spec's `client-home` testid still present; any
spec asserting the old empty-list copy updated in Step 6).

```bash
git add -A src/modules/shell src/modules/i18n src/app/routes/index.tsx
git commit -m "feat: big-card client home with humane ticking countdown (#7)"
```

---

### Task 6: `_client` layout, `/providers` route, `ProvidersScreen`, third tab

**Files:**
- Create: `src/app/routes/_client.tsx`
- Create: `src/app/routes/_client.providers.tsx`
- Create: `src/modules/shell/ProvidersScreen.tsx`
- Modify: `src/modules/shell/clientVisits.ts` (+`nextVisitByProvider`), `src/modules/shell/clientVisits.test.ts`
- Modify: `src/modules/shell/AppShell.tsx` (3 client tabs)
- Modify: `src/modules/shell/index.ts` (export `ProvidersScreen`)
- Modify: `src/modules/shell/strings.ts`
- Regenerated: `src/app/routeTree.gen.ts` (via `npx vite build`, committed)

**Interfaces:**
- Consumes: `ModeGate` (existing), `listSavedProviders`, `deleteSavedProviderWithVisits`, `SavedProvider` (Task 1), `listReceived`, `partitionVisits`, `useTickingNow` (Task 5), `formatDayLabel`.
- Produces: route `/providers` (client-gated); `nextVisitByProvider(items: ReceivedAppointment[], nowDateTime: string): Map<string, ReceivedAppointment>`; component `ProvidersScreen`; testids `providers-screen`, `provider-card`, `provider-delete`, `provider-delete-confirm`, `providers-empty`.

- [ ] **Step 1: Write the failing test**

Add to `src/modules/shell/clientVisits.test.ts`:

```ts
import { nextVisitByProvider } from './clientVisits';

describe('nextVisitByProvider', () => {
  it('maps each provider to its earliest upcoming non-cancelled visit', () => {
    const items = [
      { ...visit('v1', '2026-09-05T10:00', 'booked'), providerId: 'p1' },
      { ...visit('v2', '2026-09-02T10:00', 'booked'), providerId: 'p1' },
      { ...visit('v3', '2026-09-03T10:00', 'cancelled'), providerId: 'p2' },
      { ...visit('v4', '2026-08-01T10:00', 'booked'), providerId: 'p2' }, // past
    ];
    const map = nextVisitByProvider(items, '2026-09-01T00:00');
    expect(map.get('p1')?.id).toBe('v2');
    expect(map.has('p2')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/modules/shell/clientVisits.test.ts`
Expected: FAIL — `nextVisitByProvider` not exported.

- [ ] **Step 3: Implement logic + screen + routes + tab**

Add to `clientVisits.ts`:

```ts
// Providers tab chip: each provider's earliest upcoming non-cancelled visit.
export function nextVisitByProvider(
  items: ReceivedAppointment[],
  nowDateTime: string,
): Map<string, ReceivedAppointment> {
  const { upcoming } = partitionVisits(items, nowDateTime);
  const map = new Map<string, ReceivedAppointment>();
  for (const v of upcoming) {
    if (v.status === 'cancelled' || !v.providerId) continue;
    if (!map.has(v.providerId)) map.set(v.providerId, v);
  }
  return map;
}
```

`src/modules/shell/ProvidersScreen.tsx`:

```tsx
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getActiveLanguage, t } from '../i18n';
import { listReceived } from '../received';
import {
  deleteSavedProviderWithVisits,
  listSavedProviders,
  type SavedProvider,
} from '../savedProviders';
import { formatDayLabel } from '../schedule';
import { nextVisitByProvider } from './clientVisits';
import { useTickingNow } from './useTickingNow';

function ProviderCard({
  provider,
  nextDate,
  onDelete,
}: {
  provider: SavedProvider;
  nextDate?: string;
  onDelete: () => void;
}) {
  return (
    <li
      className="border-line bg-surface rounded-card flex flex-col gap-1.5 border p-4"
      data-testid="provider-card"
    >
      <h2 className="text-ink font-display m-0 text-lg">{provider.name}</h2>
      {provider.address && (
        <p className="text-faint text-sm">{provider.address}</p>
      )}
      {provider.phone && (
        <a
          href={`tel:${provider.phone}`}
          className="text-accent inline-flex min-h-11 items-center text-sm font-semibold no-underline"
        >
          {t('shell.clientHome.call')}: {provider.phone}
        </a>
      )}
      {nextDate && (
        <p className="text-accent text-sm">
          {t('shell.providers.nextVisit', {
            date: formatDayLabel(nextDate, getActiveLanguage()),
          })}
        </p>
      )}
      <button
        type="button"
        onClick={onDelete}
        data-testid="provider-delete"
        className="text-faint min-h-11 cursor-pointer self-start border-0 bg-transparent p-0 text-sm underline"
      >
        {t('shell.providers.delete')}
      </button>
    </li>
  );
}

// Saved-providers tab (#7 sub-project 2): flat list, no detail route.
// Records auto-upsert on import, so delete (with confirm) is the only
// management verb — it removes the record AND its visits (spec).
export function ProvidersScreen() {
  const now = useTickingNow();
  const providers = useLiveQuery(() => listSavedProviders(), []);
  const items = useLiveQuery(() => listReceived(), []);
  const [confirming, setConfirming] = useState<SavedProvider | null>(null);
  if (providers === undefined || items === undefined) return null;

  const nextBy = nextVisitByProvider(items, now);

  return (
    <main className="flex flex-col gap-4 p-4" data-testid="providers-screen">
      <h1 className="text-ink font-display text-xl">
        {t('shell.providers.title')}
      </h1>
      {providers.length === 0 && (
        <p className="text-faint" data-testid="providers-empty">
          {t('shell.providers.empty')}
        </p>
      )}
      <ul role="list" className="flex list-none flex-col gap-2 p-0">
        {providers.map((provider) => (
          <ProviderCard
            key={provider.id}
            provider={provider}
            nextDate={nextBy.get(provider.id)?.start.dateTime.slice(0, 10)}
            onDelete={() => setConfirming(provider)}
          />
        ))}
      </ul>
      {confirming && (
        <div className="border-line bg-surface rounded-card flex flex-col gap-2 border p-3">
          <p className="text-ink text-sm">
            {t('shell.providers.deleteConfirm', { name: confirming.name })}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              data-testid="provider-delete-confirm"
              onClick={() => {
                void deleteSavedProviderWithVisits(confirming.id).then(() =>
                  setConfirming(null),
                );
              }}
              className="bg-accent text-on-accent rounded-card cursor-pointer border-0 px-4 py-2 text-sm font-[650]"
            >
              {t('shell.providers.deleteAction')}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(null)}
              className="border-line bg-surface text-ink rounded-card cursor-pointer border px-4 py-2 text-sm"
            >
              {t('shell.providers.cancel')}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
```

`src/app/routes/_client.tsx` (mirror of `_provider.tsx`):

```tsx
import { createFileRoute, Outlet } from '@tanstack/react-router';
import { ModeGate } from '../../modules/shell';

// Pathless layout (adds no URL segment): everything under it is
// client-only. A provider landing on these URLs is sent home.
export const Route = createFileRoute('/_client')({
  component: () => (
    <ModeGate mode="client">
      <Outlet />
    </ModeGate>
  ),
});
```

`src/app/routes/_client.providers.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router';
import { ProvidersScreen } from '../../modules/shell';

// Route wiring only. URL is /providers — a technical identifier; the tab
// label ("Salons"/"Салони") is UI copy, not a domain term (CONTEXT.md).
export const Route = createFileRoute('/_client/providers')({
  component: ProvidersScreen,
});
```

Export `ProvidersScreen` from `src/modules/shell/index.ts`.

`AppShell.tsx` client branch: nav grid class becomes
`${mode === 'provider' ? 'grid-cols-4' : 'grid-cols-3'}`, and between the
Home and Settings links add (same classes as the Home link, no
`activeOptions`):

```tsx
            <Link
              to="/providers"
              className="text-faint data-[status=active]:text-accent flex flex-col items-center gap-[3px] text-center text-[10px] no-underline data-[status=active]:font-semibold"
            >
              <span className="text-base leading-none" aria-hidden="true">
                ⌂
              </span>
              {t('shell.tab.providers')}
            </Link>
```

Strings (both languages + `TranslationKeys`):

```ts
  // en
  'shell.tab.providers': 'Salons',
  'shell.providers.title': 'Salons',
  'shell.providers.empty':
    'Salons appear here after you scan their QR code.',
  'shell.providers.nextVisit': 'Next visit: {date}',
  'shell.providers.delete': 'Remove',
  'shell.providers.deleteConfirm': 'Remove {name} and all its visits?',
  'shell.providers.deleteAction': 'Remove',
  'shell.providers.cancel': 'Cancel',
```

```ts
  // bg
  'shell.tab.providers': 'Салони',
  'shell.providers.title': 'Салони',
  'shell.providers.empty':
    'Салоните се показват тук, след като сканирате техния QR код.',
  'shell.providers.nextVisit': 'Следващ час: {date}',
  'shell.providers.delete': 'Премахни',
  'shell.providers.deleteConfirm':
    'Да премахнем ли {name} и всичките му часове?',
  'shell.providers.deleteAction': 'Премахни',
  'shell.providers.cancel': 'Отказ',
```

- [ ] **Step 4: Regenerate the route tree**

Run: `npx vite build`
Expected: build succeeds; `src/app/routeTree.gen.ts` now contains the
`/_client/providers` branch. (Must run BEFORE any `tsc` check.)

- [ ] **Step 5: Run tests, gates, commit**

Run: `npx vitest run && npm run lint && npm run format:check && npx playwright test`
Expected: all green.

```bash
git add src/app/routes src/app/routeTree.gen.ts src/modules/shell
git commit -m "feat: saved-providers tab with delete-with-visits (#7)"
```

---

### Task 7: a11y batch (deferred from sub-project 1)

**Files:**
- Modify: `src/modules/shell/VersionFooter.tsx`
- Modify: `src/modules/shell/SettingsScreen.tsx` (`Segmented`)
- Modify: `src/modules/shell/BackupSection.tsx` (confirm-panel focus)
- Modify: `e2e/settings.spec.ts` (`aria-pressed` → `aria-checked`, ~line 112)

**Interfaces:**
- Consumes: existing components only.
- Produces: `Segmented` gains a required `label: string` prop (radiogroup name); all three call sites pass one. No other API changes.

- [ ] **Step 1: VersionFooter**

- Toggle button gains `aria-expanded={expanded}`.
- The check-result paragraph becomes persistently mounted while expanded, so
  the live region exists before its content changes (deferred from #33) —
  replace the `{typeof check === 'object' && (<p role="status">…}` block
  with an always-rendered element:

```tsx
          <p role="status">
            {typeof check === 'object' && (
              <>
                {check.status === 'up-to-date' && t('shell.version.upToDate')}
                {check.status === 'update-available' &&
                  t('shell.version.updateAvailable', {
                    version: formatBuiltAt(check.builtAt),
                  })}
                {check.status === 'failed' && t('shell.version.checkFailed')}
              </>
            )}
          </p>
```

- [ ] **Step 2: Segmented → radiogroup**

In `SettingsScreen.tsx`, `Segmented` gains `label: string`; the wrapper
becomes `role="radiogroup"` with `aria-label={label}`; each button becomes
`role="radio"` with `aria-checked={option.value === value}` (replacing
`aria-pressed`). Call sites pass the section titles they already render:
mode → `t('shell.settings.mode.label')`, theme →
`t('shell.settings.appearance.title')`, language →
`t('shell.settings.language.title')`.

In `e2e/settings.spec.ts`, update the assertion that reads `aria-pressed`
(~line 112) to `aria-checked`.

- [ ] **Step 3: Backup confirm-panel focus**

In `BackupSection.tsx`: the confirm panel `<div>` gains
`ref={confirmPanel} tabIndex={-1}` with:

```ts
  const confirmPanel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (importState.step === 'confirm') confirmPanel.current?.focus();
  }, [importState.step]);
```

(add `useEffect` to the react import).

- [ ] **Step 4: Run gates + e2e, commit**

Run: `npx vitest run && npm run lint && npm run format:check && npx playwright test`
Expected: all green.

```bash
git add src/modules/shell/VersionFooter.tsx src/modules/shell/SettingsScreen.tsx src/modules/shell/BackupSection.tsx e2e/settings.spec.ts
git commit -m "fix: a11y batch — radiogroup, live regions, confirm focus (#7)"
```

---

### Task 8: e2e client journey + full sweep

**Files:**
- Create: `e2e/client-home.spec.ts`
- Modify: `e2e/handoff.spec.ts` (extend the round-trip with phone/identity assertions)

**Interfaces:**
- Consumes: `encodeHandoff` — imported **deep** from `../src/modules/handoff/codec` (not the module index, which pulls React components into the Node test process). The codec's runtime deps are `TextEncoder`/`btoa`, both Node globals. This deep import is deliberate and commented: the modulith index-only rule governs `src/`; e2e is outside it.
- Produces: coverage for the epic's done-when.

- [ ] **Step 1: Write the client-journey spec**

`e2e/client-home.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
// Deep import on purpose: the handoff index re-exports React screens, which
// must not load in the Playwright node process. The codec is pure.
import { encodeHandoff } from '../src/modules/handoff/codec';

const BASE = '/when-again/';

function futureDateTime(daysAhead: number, time: string): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${time}`;
}

function importUrl(over: Partial<Parameters<typeof encodeHandoff>[0]> = {}) {
  return `${BASE}import#${encodeHandoff({
    id: 'e2e-appt-1',
    providerName: 'Студио Мария',
    address: 'ул. Роза 5',
    service: 'Подстригване',
    start: { dateTime: futureDateTime(3, '15:00'), timeZone: 'Europe/Sofia' },
    durationMinutes: 30,
    status: 'booked',
    providerId: 'e2e-prov-1',
    phone: '+359881234567',
    ...over,
  })}`;
}

test('import lands a fresh profile on the big-card home', async ({ page }) => {
  await page.goto(importUrl());
  await page.getByRole('button', { name: /add|добави/i }).click();
  await page.getByRole('button', { name: /done|готово/i }).click();

  const card = page.getByTestId('next-visit-card');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Подстригване');
  await expect(card).toContainText('Студио Мария');
  await expect(card).toContainText(/In \d+ day|Today at|Tomorrow at|In \d+ min/);
  await expect(card.locator('a[href^="tel:"]')).toHaveAttribute(
    'href',
    'tel:+359881234567',
  );
  // Client tab bar has three tabs now.
  await expect(page.getByRole('navigation').getByRole('link')).toHaveCount(3);
});

test('providers tab lists the salon; delete removes salon and visits', async ({
  page,
}) => {
  await page.goto(importUrl());
  await page.getByRole('button', { name: /add|добави/i }).click();
  await page.getByRole('button', { name: /done|готово/i }).click();

  await page.goto(`${BASE}providers`);
  const card = page.getByTestId('provider-card');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Студио Мария');
  await expect(card).toContainText('ул. Роза 5');

  await page.getByTestId('provider-delete').click();
  await page.getByTestId('provider-delete-confirm').click();
  await expect(page.getByTestId('providers-empty')).toBeVisible();

  await page.goto(BASE);
  await expect(page.getByTestId('next-visit-empty')).toBeVisible();
  await expect(page.getByTestId('client-visit')).toHaveCount(0);
});

test('a payload without provider id groups under the synthetic record', async ({
  page,
}) => {
  await page.goto(importUrl({ providerId: undefined, phone: undefined }));
  await page.getByRole('button', { name: /add|добави/i }).click();
  await page.getByRole('button', { name: /done|готово/i }).click();
  await page.goto(`${BASE}providers`);
  await expect(page.getByTestId('provider-card')).toContainText(
    'Студио Мария',
  );
});
```

(Adjust the two `getByRole('button', …)` name regexes to the real strings —
`handoff.import.add` / `handoff.import.done` — check `src/modules/handoff/strings.ts`
and pin exact accessible names; Playwright runs with `locale: 'en-US'`, so
the EN strings apply.)

- [ ] **Step 2: Extend the provider round-trip**

In `e2e/handoff.spec.ts`, inside the existing setup that fills the provider
profile (or right after `gotoAsProvider`): navigate to `/when-again/settings`,
fill `profile-phone` with `+359881234567`, save, then proceed with the
existing book-and-share flow. After grabbing `handoff-link`, add:

```ts
  const fragment = link!.split('#')[1];
  const wire = JSON.parse(
    Buffer.from(
      fragment.replace(/-/g, '+').replace(/_/g, '/'),
      'base64',
    ).toString('utf8'),
  ) as { k?: string; f?: string };
  expect(wire.f).toBe('+359881234567');
  expect(wire.k).toMatch(/^[0-9a-f-]{36}$/); // minted provider id rides along
```

- [ ] **Step 3: Run the full suites**

Run: `npx vitest run && npm run lint && npm run format:check && npx playwright test`
Expected: all green — record the counts (unit + e2e) for the PR body.

- [ ] **Step 4: Visual QA**

Serve `npm run dev`, view at a 390×844 viewport in BOTH themes (`data-theme`
light/dark): home with a next visit, home empty state, providers tab with a
card and with the delete confirm open. Fix token/overflow issues found
(tables/cards must not overflow horizontally; tap targets ≥44px).

- [ ] **Step 5: Commit**

```bash
git add e2e
git commit -m "test: e2e client journey — big card, providers tab, delete (#7)"
```

---

## Self-review notes (already applied)

- Spec coverage: term/identity (Tasks 1–2), payload k/f (2), profile phone +
  minted id (3), import dual-upsert + healing + synthetic fallback (4), big
  card + countdown + ticking + flat stream + empty state (5), tab + flat
  list + delete-with-visits (6), a11y batch (7), e2e for the done-when (8).
  The `role=list` item of the a11y batch lands in Tasks 5/6 (new files), the
  rest in Task 7.
- Deliberate deviations to flag in review, not silently change: codec keeps
  `providerId` OFF the decoded appointment (import assigns it); classify
  compares `providerId` so legacy rows self-heal via one "changed" cycle;
  saved-provider attributes overwrite wholesale (absent payload phone clears
  a stored phone) — that is the ADR-0002 contract.
- Known accepted gaps (spec's out-of-scope): no add-to-calendar, no detail
  route, no synthetic→minted merge, BG copy is draft.
