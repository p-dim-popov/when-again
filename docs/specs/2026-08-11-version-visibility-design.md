# Version visibility & update check — design

Issue: #33. Related: #24 (prompt SW + UpdateBanner, shipped), #30 (manual
update escape hatch — the check action here absorbs it; #30 keeps only its
documentation note and the force-recovery idea).

## Motivation

There is no in-app way to tell which build an installed PWA is running.
Invisible changes (the idb→Dexie migration in #31/#32 had zero visual tell)
can only be verified today by remote-debugging the device. With no backend
and service-worker caching, an installed app can silently lag the deployed
code.

## What ships

1. A **build stamp** baked into the bundle and shown in Settings:
   `2026-08-11 14:32 UTC · bd12529` (build date+time, minute precision, UTC;
   short commit SHA).
2. A **`version.json`** file published beside the build, naming the currently
   deployed version.
3. A **git tag per deploy** (`v2026-08-11-1432-bd12529`) pushed by CI, so
   every deploy is browsable on GitHub and any device's stamp maps 1:1 to a
   tag → exact commit.
4. A **"Check for updates"** action in Settings that compares the running
   build against the deployed `version.json`, names the incoming version, and
   stages it via the existing service-worker flow.
5. A **diagnostics detail view** (expand the version row) that adds the
   built-at timestamp and the local Dexie schema version (`db.verno`,
   currently 10), with a copy-to-clipboard affordance for bug reports.

## Version identity — single source of truth

Every push to `main` deploys; there is no manual release process, so the
version is derived automatically at build time, computed **once** in
`vite.config.ts` and used three ways (bundle stamp, `version.json`, tag):

- `commit` — `git rev-parse --short HEAD`, run at config-eval time.
- `builtAt` — the build clock, ISO-8601 UTC, minute precision.
- `version` — `<YYYY-MM-DD>-<HHmm>` derived from `builtAt`
  (e.g. `2026-08-11-1432`).

The app **never compares version strings to decide old vs new** — the
browser's byte-comparison of `sw.js` (whose embedded precache manifest
changes on every build) remains the sole update-detection and apply
mechanism. The identity here is display and bookkeeping only; `version.json`
additionally lets the UI *name* the incoming version before applying it.

No CI plumbing is needed for the values themselves: `actions/checkout` gives
CI the same git context a local build has, so CI and local builds produce
the stamp identically. Dev/preview builds are distinguished in the UI via
`import.meta.env.DEV` (a “dev” marker next to the stamp), not by changing
the identity scheme.

## Build integration (`vite.config.ts`)

- Compute `{ version, commit, builtAt }` at config-eval time.
- Bake into the bundle via `define`: `__BUILD_VERSION__`, `__BUILD_COMMIT__`,
  `__BUILD_DATE__` (ambient declarations in a `.d.ts` beside the existing
  Vite env types).
- Emit `version.json` into the build output via a small inline plugin using
  `emitFile` in `generateBundle`:

  ```json
  { "version": "2026-08-11-1432", "commit": "bd12529", "builtAt": "2026-08-11T14:32:00Z" }
  ```

- **Precache exclusion (critical):** add `workbox: { globIgnores:
  ['**/version.json'] }` to the VitePWA options. Without it the service
  worker precaches the *old* version's file and the check would forever
  report "up to date". The client additionally fetches it with `cache:
  'no-store'` so the HTTP cache never answers either.

## Deploy tagging (`.github/workflows/deploy.yml`)

- Flip the workflow-level `contents:` permission from `read` to `write`
  (default `GITHUB_TOKEN`, still zero secrets).
- After a successful Pages deploy, one step reads `dist/version.json` and
  creates+pushes the tag `v<version>-<commit>` (e.g.
  `v2026-08-11-1432-bd12529`) pointing at the deployed commit.
- **Idempotent:** if the tag already exists (workflow re-run), the step
  skips without failing. Tag creation failure must not fail the deploy
  (the site is already live at that point) — but it should be visible in
  the workflow summary.
- GitHub *Releases* are out of scope — tags only.

## UI: `VersionFooter` widget (module `shell`)

Lives in `src/modules/shell/` (which already owns `SettingsScreen` and
`UpdateBanner`), exported through the module's `index.ts`, mounted at the
bottom of the current placeholder Settings screen. Built self-contained so
Epic 7's real Settings screen re-mounts it unchanged.

**Collapsed (default):** one quiet line — `2026-08-11 14:32 UTC · bd12529`
(+ “dev” marker in dev builds).

**Expanded (tap the row):** the short SHA *is* the identity everywhere
(tag, stamp, `version.json`) — no long-SHA variant. The expanded view shows:
- Version, commit, and built-at (the same values, itemised).
- Local data version: the Dexie schema version read from `db.verno`
  (`shell` imports the `db` module's public API; `db` is a leaf, so the
  dependency graph stays acyclic).
- A **copy** action that puts the whole diagnostic block (version, commit,
  built-at, data version) on the clipboard for bug reports.
- The **Check for updates** action (below).

## Check for updates — behaviour

Two-stage; the existing banner remains the single apply-path:

1. Fetch `` `${import.meta.env.BASE_URL}version.json` `` with
   `{ cache: 'no-store' }`; compare its `commit` with `__BUILD_COMMIT__`.
   - **Equal** → "You are up to date."
   - **Different** → "New version: 2026-08-11 16:05" (the incoming
     stamp, named *before* applying). Any difference counts as an update —
     no ordering logic (a rollback is also an update).
2. On difference, also call
   `navigator.serviceWorker.getRegistration().then(r => r?.update())` so the
   new worker stages immediately; when it reaches *waiting*, `needRefresh`
   flips in `App.tsx` and the existing **UpdateBanner** appears to apply it.
   The widget needs no registration handle from `src/app` and adds no new
   SW wiring.
3. **Offline / fetch fails** → a calm inline "Could not check. Connect to
   the internet and try again." — the rejection is caught; no crash, no
   retry loop.

States are mutually exclusive and transient: idle → checking →
(up-to-date | update-available | failed), reset on next check.

## Strings

All user-facing strings go through the `i18n` module following the existing
`modules/shell/strings.ts` augmentation pattern; Simplified Technical
English; EN + BG (BG drafted, pending the native-speaker pass). Needed keys
(final wording at implementation): version row label, dev marker, data
version label, copy action + copied confirmation, check action, checking,
up-to-date, update-available (with version interpolation), check-failed.

## Testing

- **Vitest:** stamp/version formatting from `builtAt`; the check-action
  state machine (up-to-date / update-available / failed) with mocked
  `fetch` and `navigator.serviceWorker`; diagnostics block content
  (mocked `db.verno`).
- **e2e (Playwright):** Settings renders the version footer with a
  non-empty stamp (one light assertion; the SW flow itself is already
  covered by manual on-device verification).
- **CI/workflow:** tag step verified on the first real deploy (tag appears,
  matches the live `version.json`); a workflow re-run must not fail on the
  existing tag.
- **On-device:** after deploy, open Settings and read the stamp — the exact
  capability this feature exists to provide.

## Out of scope

- GitHub Releases (a release per push would be noise).
- Automatic background polling of `version.json` (the hourly SW re-check
  from #24 already covers passive discovery; the file is fetched only on
  manual check).
- Force-recovery (unregister SW + reload) for a wedged worker — stays with
  #30.
- Semver / changelogs / update history.
