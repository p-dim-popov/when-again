# Version Visibility & Update Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bake a build identity (date+time UTC + short SHA) into the bundle, publish it as `version.json`, tag every deploy on GitHub, and surface a version footer with a manual "check for updates" action on the Settings screen.

**Architecture:** The version identity is computed once in `vite.config.ts` (config-eval time) and used three ways: `define`-injected constants for the bundle, an emitted `dist/version.json`, and a CI-pushed git tag. The UI widget (`VersionFooter`, module `shell`) reads the baked constants, fetches `version.json` with `cache: 'no-store'` to name the incoming version, and stages updates through the existing service-worker flow (`registration.update()` → `needRefresh` → existing `UpdateBanner`). No new SW wiring; the app never compares versions to decide old-vs-new — the browser's byte-comparison of `sw.js` stays the sole detection/apply mechanism.

**Tech Stack:** Vite `define` + inline Rollup plugin (`emitFile`), vite-plugin-pwa (Workbox `globIgnores`), Dexie (`db.backendDB().version`), React + `dexie-react-hooks`, Vitest, Playwright, GitHub Actions.

**Design spec:** `docs/specs/2026-08-11-version-visibility-design.md` (read for rationale; this plan is self-contained for execution).

## Global Constraints

- Version identity, exact formats: `builtAt` = ISO-8601 UTC minute precision (`2026-08-11T14:32:00Z`); `version` = `<YYYY-MM-DD>-<HHmm>` (`2026-08-11-1432`); `commit` = `git rev-parse --short HEAD`; UI stamp = `2026-08-11 14:32 UTC · bd12529`; tag = `v<version>-<commit>` (`v2026-08-11-1432-bd12529`).
- `version.json` MUST be excluded from the Workbox precache (`globIgnores: ['**/version.json']`) and fetched with `{ cache: 'no-store' }`.
- Never hardcode `/when-again/` in app code — use `import.meta.env.BASE_URL`. (e2e specs already use the literal path; that is allowed there.)
- Zero secrets in CI: tag push uses the default `GITHUB_TOKEN` with `contents: write`. Tag-step failure must NOT fail the deploy; tag creation is idempotent (skip if the tag exists).
- All user-facing strings go through the `i18n` module (`t()`), Simplified Technical English, EN + BG (BG is a draft pending a native-speaker pass).
- Modulith rules: cross-module imports only via `index.ts`; `db` stays a leaf; `dexie` is imported only in data-layer modules; `dexie-react-hooks` is the UI read primitive.
- Tailwind utilities in JSX only; use existing tokens (`text-ink`, `border-line`, `bg-surface`, `bg-accent`, `text-on-accent`, `rounded-card`); no `dark:` variants.
- npm; TypeScript pinned `~6.0.3`; run `npx prettier --check .`-equivalent (`npm run format:check`) before each commit — ESLint-clean ≠ Prettier-clean.
- Commit messages: never include a Claude session link; "Generated with Claude Code" attribution is fine.

---

## File Map

| File | Change | Owner task |
|---|---|---|
| `vite.config.ts` | build identity, `define`, version.json plugin, `globIgnores` | 1 |
| `src/build-info.d.ts` | create — ambient declarations for the defines | 1 |
| `vitest.config.ts` | add `define` test values | 1 |
| `src/modules/shell/buildInfo.ts` (+ test) | create — typed access + stamp formatting | 1 |
| `src/modules/db/db.ts` (+ `db.test.ts`, `index.ts`) | add `getDataVersion()` | 2 |
| `src/modules/shell/updateCheck.ts` (+ test) | create — check-for-updates state machine | 3 |
| `src/modules/shell/VersionFooter.tsx` | create — the widget | 4 |
| `src/modules/shell/strings.ts` | add version strings EN+BG | 4 |
| `src/modules/shell/SettingsScreen.tsx` | mount the footer | 4 |
| `src/modules/shell/index.ts` | export `VersionFooter` | 4 |
| `e2e/smoke.spec.ts` | stamp visibility assertion | 4 |
| `.github/workflows/deploy.yml` | `contents: write` + tag step | 5 |

---

### Task 1: Build identity — constants, `version.json`, formatting helpers

**Files:**
- Modify: `vite.config.ts`
- Create: `src/build-info.d.ts`
- Modify: `vitest.config.ts`
- Create: `src/modules/shell/buildInfo.ts`
- Test: `src/modules/shell/buildInfo.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: globals `__BUILD_VERSION__: string`, `__BUILD_COMMIT__: string`, `__BUILD_DATE__: string`; from `./buildInfo` (module `shell`, internal): `buildInfo: { version: string; commit: string; builtAt: string; dev: boolean }`, `formatBuiltAt(builtAt: string): string`, `formatStamp(info: { builtAt: string; commit: string }): string`. Build output gains `dist/version.json` `{ version, commit, builtAt }`, excluded from the SW precache.

- [ ] **Step 1: Write the failing tests**

Create `src/modules/shell/buildInfo.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildInfo, formatBuiltAt, formatStamp } from './buildInfo';

describe('formatBuiltAt', () => {
  it('formats a minute-precision ISO timestamp as "date time UTC"', () => {
    expect(formatBuiltAt('2026-08-11T14:32:00Z')).toBe('2026-08-11 14:32 UTC');
  });
});

describe('formatStamp', () => {
  it('joins built-at and commit with a middle dot', () => {
    expect(
      formatStamp({ builtAt: '2026-08-11T14:32:00Z', commit: 'bd12529' }),
    ).toBe('2026-08-11 14:32 UTC · bd12529');
  });
});

describe('buildInfo', () => {
  it('carries the build constants injected by the bundler config', () => {
    expect(buildInfo).toMatchObject({
      version: '2026-01-02-0304',
      commit: 'testsha',
      builtAt: '2026-01-02T03:04:00Z',
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/modules/shell/buildInfo.test.ts`
Expected: FAIL — cannot resolve `./buildInfo`.

- [ ] **Step 3: Declare the globals and define them for tests**

Create `src/build-info.d.ts`:

```ts
// Build identity injected by `define` in vite.config.ts (see the version
// spec, docs/specs/2026-08-11-version-visibility-design.md). Vitest injects
// fixed test values in vitest.config.ts.
declare const __BUILD_VERSION__: string;
declare const __BUILD_COMMIT__: string;
declare const __BUILD_DATE__: string;
```

Modify `vitest.config.ts` to inject fixed values (whole file after the change):

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Fixed stand-ins for the build identity that vite.config.ts derives from
  // git and the build clock — tests must not depend on either.
  define: {
    __BUILD_VERSION__: JSON.stringify('2026-01-02-0304'),
    __BUILD_COMMIT__: JSON.stringify('testsha'),
    __BUILD_DATE__: JSON.stringify('2026-01-02T03:04:00Z'),
  },
  test: {
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test/setup-db.ts'],
    passWithNoTests: true,
  },
});
```

- [ ] **Step 4: Implement `buildInfo.ts`**

Create `src/modules/shell/buildInfo.ts`:

```ts
// Typed access to the build identity baked in by `define` (vite.config.ts).
// Display-only: the app never compares versions to decide old-vs-new — the
// browser's byte-comparison of sw.js is the sole update-detection mechanism.
export const buildInfo = {
  version: __BUILD_VERSION__,
  commit: __BUILD_COMMIT__,
  builtAt: __BUILD_DATE__,
  dev: import.meta.env.DEV,
};

// '2026-08-11T14:32:00Z' → '2026-08-11 14:32 UTC'
export function formatBuiltAt(builtAt: string): string {
  return `${builtAt.slice(0, 10)} ${builtAt.slice(11, 16)} UTC`;
}

// → '2026-08-11 14:32 UTC · bd12529'
export function formatStamp(info: { builtAt: string; commit: string }): string {
  return `${formatBuiltAt(info.builtAt)} · ${info.commit}`;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/modules/shell/buildInfo.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Wire the build identity into `vite.config.ts`**

Modify `vite.config.ts`. Add imports and the identity block after the existing `base` constant, then add `define`, the inline plugin, and the `workbox` option:

```ts
import { execSync } from 'node:child_process';
```

After `const base = …`:

```ts
// Build identity (#33): computed once here, used three ways — baked into the
// bundle via `define`, published as dist/version.json, and turned into a git
// tag by the deploy workflow. Minute precision, UTC.
const builtAt = `${new Date().toISOString().slice(0, 16)}:00Z`;
const buildInfo = {
  version: `${builtAt.slice(0, 10)}-${builtAt.slice(11, 13)}${builtAt.slice(14, 16)}`,
  commit: execSync('git rev-parse --short HEAD').toString().trim(),
  builtAt,
};
```

Inside `defineConfig({ … })`, add a top-level `define` next to `base`:

```ts
  define: {
    __BUILD_VERSION__: JSON.stringify(buildInfo.version),
    __BUILD_COMMIT__: JSON.stringify(buildInfo.commit),
    __BUILD_DATE__: JSON.stringify(buildInfo.builtAt),
  },
```

In the `plugins` array, add after the `VitePWA(…)` entry:

```ts
    {
      name: 'emit-version-json',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: `${JSON.stringify(buildInfo, null, 2)}\n`,
        });
      },
    },
```

In the `VitePWA({ … })` options, add after `registerType: 'prompt',`:

```ts
      // version.json names the *currently deployed* build; if the SW
      // precached it, the app would forever read its own (stale) copy and
      // "check for updates" would always say up-to-date. Clients fetch it
      // with { cache: 'no-store' } (see modules/shell/VersionFooter).
      workbox: { globIgnores: ['**/version.json'] },
```

- [ ] **Step 7: Verify the build output**

Run: `npm run build && cat dist/version.json && grep -c 'version\.json' dist/sw.js || true`
Expected: `dist/version.json` prints `{ "version": "…", "commit": "…", "builtAt": "…" }` matching the formats in Global Constraints, and the `grep -c` on `dist/sw.js` prints `0` (not in the precache manifest).

- [ ] **Step 8: Full verification and commit**

Run: `npx tsc -b && npm run lint && npm run format:check && npx vitest run`
Expected: all clean/green (run `npx prettier --write .` first if format:check flags the new files).

```bash
git add vite.config.ts vitest.config.ts src/build-info.d.ts src/modules/shell/buildInfo.ts src/modules/shell/buildInfo.test.ts
git commit -m "feat: bake build identity into bundle and emit version.json"
```

---

### Task 2: `getDataVersion()` in the db module

**Files:**
- Modify: `src/modules/db/db.ts`
- Modify: `src/modules/db/index.ts`
- Test: `src/modules/db/db.test.ts` (create)

**Interfaces:**
- Consumes: the existing `db` Dexie instance in `src/modules/db/db.ts`.
- Produces: `getDataVersion(): Promise<number>` exported from the `db` module's public API — resolves to the **native IndexedDB version** (declared Dexie version × 10; currently 10), matching what `indexedDB.databases()` / chrome://inspect report on a device.

- [ ] **Step 1: Write the failing test**

Create `src/modules/db/db.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getDataVersion } from './db';

describe('getDataVersion', () => {
  it('reports the native IndexedDB version (declared Dexie version × 10)', async () => {
    // src/test/setup-db.ts declares every store at Dexie version(1),
    // which Dexie opens as native IndexedDB version 10.
    expect(await getDataVersion()).toBe(10);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/modules/db/db.test.ts`
Expected: FAIL — `getDataVersion` is not exported.

- [ ] **Step 3: Implement**

In `src/modules/db/db.ts`, add:

```ts
// Native IndexedDB version of the local database — what indexedDB.databases()
// and chrome://inspect report on a device (declared Dexie version × 10).
// Surfaced as a diagnostic so a data migration can be verified in-app (#33).
export async function getDataVersion(): Promise<number> {
  await db.open();
  return db.backendDB().version;
}
```

(`db.open()` resolves immediately when the connection is already open, so
this is safe to call from UI code at any time.)

In `src/modules/db/index.ts`, add `getDataVersion` to the existing export list from `'./db'`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/modules/db/db.test.ts`
Expected: PASS.

- [ ] **Step 5: Full verification and commit**

Run: `npx tsc -b && npm run lint && npm run format:check && npx vitest run`
Expected: all green.

```bash
git add src/modules/db/db.ts src/modules/db/index.ts src/modules/db/db.test.ts
git commit -m "feat: expose native IndexedDB version as db diagnostic"
```

---

### Task 3: `checkForUpdates` state machine

**Files:**
- Create: `src/modules/shell/updateCheck.ts`
- Test: `src/modules/shell/updateCheck.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks (dependencies are injected).
- Produces (module `shell`, internal):

```ts
type RemoteVersion = { version: string; commit: string; builtAt: string };
type UpdateCheckResult =
  | { status: 'up-to-date' }
  | { status: 'update-available'; version: string; builtAt: string }
  | { status: 'failed' };
function checkForUpdates(deps: {
  fetchVersion: () => Promise<RemoteVersion>;
  currentCommit: string;
  triggerSwUpdate: () => Promise<void>;
}): Promise<UpdateCheckResult>;
```

- [ ] **Step 1: Write the failing tests**

Create `src/modules/shell/updateCheck.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { checkForUpdates, type RemoteVersion } from './updateCheck';

const remote: RemoteVersion = {
  version: '2026-08-12-0910',
  commit: 'abc1234',
  builtAt: '2026-08-12T09:10:00Z',
};

describe('checkForUpdates', () => {
  it('reports up-to-date when the deployed commit matches', async () => {
    const triggerSwUpdate = vi.fn();
    const result = await checkForUpdates({
      fetchVersion: async () => ({ ...remote, commit: 'same123' }),
      currentCommit: 'same123',
      triggerSwUpdate,
    });
    expect(result).toEqual({ status: 'up-to-date' });
    expect(triggerSwUpdate).not.toHaveBeenCalled();
  });

  it('names the incoming version and stages the worker when commits differ', async () => {
    const triggerSwUpdate = vi.fn().mockResolvedValue(undefined);
    const result = await checkForUpdates({
      fetchVersion: async () => remote,
      currentCommit: 'old0000',
      triggerSwUpdate,
    });
    expect(result).toEqual({
      status: 'update-available',
      version: '2026-08-12-0910',
      builtAt: '2026-08-12T09:10:00Z',
    });
    expect(triggerSwUpdate).toHaveBeenCalledOnce();
  });

  it('fails calmly when the fetch rejects (offline)', async () => {
    const triggerSwUpdate = vi.fn();
    const result = await checkForUpdates({
      fetchVersion: async () => {
        throw new Error('offline');
      },
      currentCommit: 'any',
      triggerSwUpdate,
    });
    expect(result).toEqual({ status: 'failed' });
    expect(triggerSwUpdate).not.toHaveBeenCalled();
  });

  it('fails calmly when the payload is not a version file', async () => {
    // A SPA-fallback HTML response parsed as JSON, or any wrong shape.
    const result = await checkForUpdates({
      fetchVersion: async () => ({}) as RemoteVersion,
      currentCommit: 'any',
      triggerSwUpdate: vi.fn(),
    });
    expect(result).toEqual({ status: 'failed' });
  });

  it('still reports the update when staging the worker fails', async () => {
    const result = await checkForUpdates({
      fetchVersion: async () => remote,
      currentCommit: 'old0000',
      triggerSwUpdate: vi.fn().mockRejectedValue(new Error('no SW')),
    });
    expect(result).toEqual({
      status: 'update-available',
      version: '2026-08-12-0910',
      builtAt: '2026-08-12T09:10:00Z',
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/modules/shell/updateCheck.test.ts`
Expected: FAIL — cannot resolve `./updateCheck`.

- [ ] **Step 3: Implement**

Create `src/modules/shell/updateCheck.ts`:

```ts
// Manual "check for updates" (#33, absorbing the #30 escape hatch). The
// deployed version.json only *names* what is live; any commit difference
// counts as an update (a rollback too — no ordering logic). Applying still
// goes through the one existing path: triggerSwUpdate stages the new worker,
// needRefresh flips in src/app/App.tsx, and the UpdateBanner applies it.
export type RemoteVersion = {
  version: string;
  commit: string;
  builtAt: string;
};

export type UpdateCheckResult =
  | { status: 'up-to-date' }
  | { status: 'update-available'; version: string; builtAt: string }
  | { status: 'failed' };

function isRemoteVersion(value: unknown): value is RemoteVersion {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.version === 'string' &&
    typeof record.commit === 'string' &&
    typeof record.builtAt === 'string'
  );
}

export async function checkForUpdates(deps: {
  fetchVersion: () => Promise<RemoteVersion>;
  currentCommit: string;
  triggerSwUpdate: () => Promise<void>;
}): Promise<UpdateCheckResult> {
  let remote: unknown;
  try {
    remote = await deps.fetchVersion();
  } catch {
    return { status: 'failed' };
  }
  if (!isRemoteVersion(remote)) return { status: 'failed' };
  if (remote.commit === deps.currentCommit) return { status: 'up-to-date' };
  try {
    await deps.triggerSwUpdate();
  } catch {
    // Staging failed (no SW in this context, transient error) — the check
    // still names the update; the hourly re-check remains the fallback.
  }
  return {
    status: 'update-available',
    version: remote.version,
    builtAt: remote.builtAt,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/modules/shell/updateCheck.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Full verification and commit**

Run: `npx tsc -b && npm run lint && npm run format:check && npx vitest run`
Expected: all green.

```bash
git add src/modules/shell/updateCheck.ts src/modules/shell/updateCheck.test.ts
git commit -m "feat: add check-for-updates state machine"
```

---

### Task 4: `VersionFooter` widget, strings, Settings mount, e2e

**Files:**
- Create: `src/modules/shell/VersionFooter.tsx`
- Modify: `src/modules/shell/strings.ts`
- Modify: `src/modules/shell/SettingsScreen.tsx`
- Modify: `src/modules/shell/index.ts`
- Test: `e2e/smoke.spec.ts` (add one test)

**Interfaces:**
- Consumes: `buildInfo`, `formatBuiltAt`, `formatStamp` from `./buildInfo` (Task 1); `checkForUpdates`, `RemoteVersion`, `UpdateCheckResult` from `./updateCheck` (Task 3); `getDataVersion` from `../db` (Task 2); `t` from `../i18n`; `useLiveQuery` from `dexie-react-hooks`.
- Produces: `VersionFooter` React component, exported from `src/modules/shell/index.ts` (Epic 7's real Settings screen re-mounts it unchanged).

- [ ] **Step 1: Add the strings**

In `src/modules/shell/strings.ts`, add to the `en` object:

```ts
  'shell.version.dev': 'dev',
  'shell.version.data': 'Data version',
  'shell.version.copy': 'Copy',
  'shell.version.copied': 'Copied',
  'shell.version.check': 'Check for updates',
  'shell.version.checking': 'Checking…',
  'shell.version.upToDate': 'You are up to date.',
  'shell.version.updateAvailable': 'New version: {version}',
  'shell.version.checkFailed':
    'Could not check. Connect to the internet and try again.',
```

Add to the `bg` object (draft — pending native-speaker pass, like the rest of the BG copy):

```ts
  'shell.version.dev': 'dev',
  'shell.version.data': 'Версия на данните',
  'shell.version.copy': 'Копирай',
  'shell.version.copied': 'Копирано',
  'shell.version.check': 'Провери за нова версия',
  'shell.version.checking': 'Проверка…',
  'shell.version.upToDate': 'Използвате най-новата версия.',
  'shell.version.updateAvailable': 'Нова версия: {version}',
  'shell.version.checkFailed':
    'Проверката е неуспешна. Свържете се с интернет и опитайте отново.',
```

Add the same nine keys to the `declare module '../i18n'` block:

```ts
    'shell.version.dev': true;
    'shell.version.data': true;
    'shell.version.copy': true;
    'shell.version.copied': true;
    'shell.version.check': true;
    'shell.version.checking': true;
    'shell.version.upToDate': true;
    'shell.version.updateAvailable': true;
    'shell.version.checkFailed': true;
```

- [ ] **Step 2: Implement the widget**

Create `src/modules/shell/VersionFooter.tsx`:

```tsx
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getDataVersion } from '../db';
import { t } from '../i18n';
import { buildInfo, formatBuiltAt, formatStamp } from './buildInfo';
import {
  checkForUpdates,
  type RemoteVersion,
  type UpdateCheckResult,
} from './updateCheck';

// Version footer (#33): a quiet build stamp, expandable into diagnostics
// (data version, copy-for-bug-report) and a manual update check. Built
// self-contained so Epic 7's real Settings screen re-mounts it unchanged.

async function fetchVersion(): Promise<RemoteVersion> {
  // no-store: version.json names the *deployed* build, so neither the HTTP
  // cache nor the service worker may answer (it is also excluded from the
  // precache via globIgnores in vite.config.ts).
  const response = await fetch(`${import.meta.env.BASE_URL}version.json`, {
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`version.json: HTTP ${response.status}`);
  return (await response.json()) as RemoteVersion;
}

async function triggerSwUpdate(): Promise<void> {
  const registration = await navigator.serviceWorker?.getRegistration();
  await registration?.update();
}

export function VersionFooter() {
  const [expanded, setExpanded] = useState(false);
  const [check, setCheck] = useState<'idle' | 'checking' | UpdateCheckResult>(
    'idle',
  );
  const [copied, setCopied] = useState(false);
  const dataVersion = useLiveQuery(() => getDataVersion(), []);

  const runCheck = () => {
    setCheck('checking');
    void checkForUpdates({
      fetchVersion,
      currentCommit: buildInfo.commit,
      triggerSwUpdate,
    }).then(setCheck);
  };

  const copyDiagnostics = () => {
    const block = [
      `version: ${buildInfo.version}`,
      `commit: ${buildInfo.commit}`,
      `builtAt: ${buildInfo.builtAt}`,
      `dataVersion: ${dataVersion ?? 'unknown'}`,
    ].join('\n');
    void navigator.clipboard.writeText(block).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <footer className="text-ink mt-8 text-center text-xs opacity-70">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="cursor-pointer"
      >
        {formatStamp(buildInfo)}
        {buildInfo.dev ? ` (${t('shell.version.dev')})` : ''}
      </button>
      {expanded && (
        <div className="mt-2 flex flex-col items-center gap-1">
          <p>
            {t('shell.version.data')}: {dataVersion ?? '…'}
          </p>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={copyDiagnostics}
              className="cursor-pointer underline"
            >
              {copied ? t('shell.version.copied') : t('shell.version.copy')}
            </button>
            <button
              type="button"
              onClick={runCheck}
              disabled={check === 'checking'}
              className="cursor-pointer underline"
            >
              {check === 'checking'
                ? t('shell.version.checking')
                : t('shell.version.check')}
            </button>
          </div>
          {typeof check === 'object' && (
            <p role="status">
              {check.status === 'up-to-date' && t('shell.version.upToDate')}
              {check.status === 'update-available' &&
                t('shell.version.updateAvailable', {
                  version: formatBuiltAt(check.builtAt),
                })}
              {check.status === 'failed' && t('shell.version.checkFailed')}
            </p>
          )}
        </div>
      )}
    </footer>
  );
}
```

- [ ] **Step 3: Mount it and export it**

In `src/modules/shell/SettingsScreen.tsx`: add `import { VersionFooter } from './VersionFooter';` and render `<VersionFooter />` as the last child of the inner `<div>` (after `<LanguageToggle />`).

In `src/modules/shell/index.ts`, add:

```ts
export { VersionFooter } from './VersionFooter';
```

- [ ] **Step 4: Add the e2e assertion**

Append to `e2e/smoke.spec.ts`:

```ts
test('settings shows the build stamp', async ({ page }) => {
  await page.goto('/when-again/settings');
  await expect(
    page.getByText(/\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC · [0-9a-f]{7,}/),
  ).toBeVisible();
});
```

- [ ] **Step 5: Run the e2e suite**

Run: `npx playwright test`
Expected: all pass, including the new stamp test (the e2e webServer serves a real production build, so the stamp is real).

- [ ] **Step 6: Full verification and commit**

Run: `npx tsc -b && npm run lint && npm run format:check && npx vitest run`
Expected: all green.

```bash
git add src/modules/shell/VersionFooter.tsx src/modules/shell/strings.ts src/modules/shell/SettingsScreen.tsx src/modules/shell/index.ts e2e/smoke.spec.ts
git commit -m "feat: add version footer with update check to Settings"
```

---

### Task 5: Deploy tagging in CI

**Files:**
- Modify: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: `dist/version.json` (Task 1) — present in the job workspace because build and deploy run in the same job.
- Produces: a git tag `v<version>-<commit>` per successful deploy.

- [ ] **Step 1: Update the workflow**

Modify `.github/workflows/deploy.yml`:

1. Change the workflow-level permission `contents: read` → `contents: write` (needed to push the tag; still zero secrets — the default `GITHUB_TOKEN` does it).
2. Append a final step after the `deploy-pages` step:

```yaml
      # Tag every deploy (#33) so any device's version stamp maps 1:1 to a
      # tag → exact commit. Idempotent (re-runs skip), and never fails the
      # deploy — the site is already live by this point.
      - name: Tag deploy
        continue-on-error: true
        run: |
          VERSION=$(node -p "require('./dist/version.json').version")
          COMMIT=$(node -p "require('./dist/version.json').commit")
          TAG="v${VERSION}-${COMMIT}"
          if git ls-remote --exit-code origin "refs/tags/${TAG}" >/dev/null 2>&1; then
            echo "Tag ${TAG} already exists — skipping." >> "$GITHUB_STEP_SUMMARY"
            exit 0
          fi
          git tag "${TAG}"
          git push origin "${TAG}"
          echo "Tagged deploy as ${TAG}." >> "$GITHUB_STEP_SUMMARY"
```

(`actions/checkout` persists the token-backed git credentials by default, so `git push origin <tag>` authenticates without extra setup. A lightweight tag needs no committer identity, so no `git config` is required.)

- [ ] **Step 2: Validate the workflow file**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml')); print('YAML OK')"`
Expected: `YAML OK`.

Run: `npm run format:check`
Expected: clean (run `npx prettier --write .github/workflows/deploy.yml` first if flagged).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: tag each deploy with the build version"
```

(Live verification — tag appears and matches the deployed `version.json`, and a workflow re-run skips without failing — happens on the first real deploy after merge; it is listed in the spec's testing section and belongs to the post-merge checklist, not this task.)

---

## Post-merge verification (whole feature)

1. Merge → Deploy workflow green; a tag `v<date>-<HHmm>-<sha>` appears on the repo matching `https://p-dim-popov.github.io/when-again/version.json`.
2. On the phone: open Settings → the stamp shows the new build. Expand → data version 10. Tap "Check for updates" → "You are up to date."
3. After the *next* deploy, on a stale client: "Check for updates" names the newer version and the existing UpdateBanner appears; refreshing lands on the new stamp.
