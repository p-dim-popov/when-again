# Mode infrastructure & real Settings screen — design

Epic #7, sub-project 1 of 2. Sub-project 2 (big-card client home, salons,
save-salon) builds on this and gets its own spec. Related: the version
footer (#33, shipped) is re-mounted here; the temporary language toggle and
placeholder Settings screen (Epic 4) are retired.

## Motivation

The app is provider-only today: `settings.mode` exists but nothing sets or
reads it, a client who imports an appointment has no home, the QR payload
carries an empty provider name (no profile UI), the backup module (Epic 3)
has no UI, and the theme override (`[data-theme]`, wired since the restyle)
has no control. This sub-project makes the provider↔client duality real and
replaces the placeholder Settings screen with the permanent one.

North star (standing decision): providers are also clients; mode is never
locked; switching is easy and bidirectional.

## Mode semantics

`settings.mode: 'provider' | 'client' | null` stays the single source of
truth. Both data stores (`appointments`, `received`) always exist regardless
of mode — mode only decides what the shell shows. Two writers:

1. **Inference:** a successful import on `/import` sets `mode = 'client'`
   **only if mode is currently `null`**. It never flips an existing choice —
   a provider scanning another salon's QR stays a provider (the import still
   lands in `received` and is visible after switching).
2. **Choice:** the first-run chooser and the Settings switch (below).

## Routing: reactive component guards

No `beforeLoad` guards — guarding is done with reactive components so a mode
flip re-evaluates everything instantly (no `router.invalidate()`), matching
the codebase rule that local reads are reactive.

- **`ModeGate`** (module `shell`): `{ mode: Mode; children }`. Reads settings
  via `useLiveQuery`. Loading → renders `null` (no flash). Match → children.
  Mismatch → `<Navigate to="/" replace />`. `mode === null` → renders `null`
  (the root-level chooser is handling it).
- **Pathless layout `_provider`** (`src/app/routes/_provider.tsx`):
  `<ModeGate mode="provider"><Outlet /></ModeGate>`. The provider-only
  routes move under it: `/book`, `/appointment/new`, `/appointment/saved`,
  `/clients`. URLs do not change (pathless layouts add no segment). Sub-
  project 2 adds a `_client` twin for client-only routes.
- **Home `/`** stays a single route (two routes cannot both claim `/`); its
  component branches by mode: provider → existing `ScheduleScreen`, client →
  `ClientVisitsList` (below). The `/?date=…&appt=…` contract from Epic 4 is
  untouched.
- **First-run chooser:** the root layout renders `<FirstRunChooser />`
  instead of the outlet when settings have loaded, `mode === null`, and the
  current path is not `/import`. Two large buttons — "I book appointments"
  (client) / "I manage a schedule" (provider) — persisting the choice
  removes the chooser reactively. No dedicated route, no redirects.
- `/import` and `/settings` remain reachable in every mode (including
  `null`, for `/import`).

## Client shell (v1)

Client mode swaps the tab bar: **Home** (`/`) and **Settings** only — no
booking/schedule tabs. `AppShell` reads mode via `useLiveQuery` and renders
the tab set accordingly (provider tabs unchanged).

**`ClientVisitsList`** (v1 home, deliberately plain — sub-project 2 replaces
it with the big-card home & salons): chronological list of `listReceived()`
appointments — service, provider name, date + time (existing wall-clock
formatting), cancelled entries struck through / dimmed with a cancelled
label. Upcoming first (soonest on top), past below. Empty state: a calm
"appointments you receive from a salon appear here" line. No actions on the
items in v1.

## Settings screen v1

Replaces the placeholder `shell/SettingsScreen`. Stays in module `shell`
(it is app-frame concern; imports only public APIs of `settings`, `backup`,
`i18n`, `db` — acyclic). Sections top to bottom:

1. **Mode** — segmented control Provider / Client, always visible, applies
   immediately (`updateSettings({ mode })`); the reactive shell/guards do
   the rest. No confirmation — switching is loss-free by design.
2. **Profile** *(provider mode only)* — provider name + address text
   fields persisted to settings (`providerName`, `address`). Fixes the
   empty provider name in QR/share payloads (`HandoffShare` already
   consumes these). Saved on blur/submit with the existing form idioms.
3. **Appearance** — theme segmented control Light / Dark / Auto. New
   settings field `theme: 'light' | 'dark' | null` (null = Auto). Applying:
   set/remove `data-theme` on `<html>` immediately (no reload) and persist;
   boot applies the persisted value in `main.tsx` before first paint. Auto
   removes the attribute so `prefers-color-scheme` rules.
4. **Language** — БГ / EN / Auto, permanent control using the existing
   `applyLanguageChoice` contract (persist + reload). The temporary
   `LanguageToggle` widget and its export are deleted.
5. **Backup** *(provider mode only in v1)* — Export button (generate the
   backup JSON via the existing `backup` module, trigger a file download,
   stamp `lastBackupAt`), Import button (file picker → `parseBackup`
   validation → explicit confirm step naming what will be replaced →
   import), and a "last backup: N days ago / never" line that shows the
   existing 31-day staleness nudge. Client-mode backup is deferred: the
   backup format does not include the `received` store, and silently
   shipping a backup that omits the client's data would mislead — noted as
   a follow-up (extend the format, version 2) rather than shipped wrong.
6. **Version footer** — the existing `VersionFooter` (#33), unchanged.

## Data changes

- `Settings` gains `theme: 'light' | 'dark' | null` (default `null`) in
  `DEFAULT_SETTINGS`. No Dexie schema/version bump (settings rows carry no
  indexed fields for this). Old backups without `theme` import cleanly
  (defaults fill it).
- No changes to `appointments` or `received`.

## Strings

All new user-facing strings via `i18n` `t()` following the per-module
`strings.ts` pattern; Simplified Technical English; EN + BG (BG stays a
draft pending the native-speaker pass). Affected modules: `shell` (chooser,
tabs, settings sections, client list, backup states).

## Testing

- **Unit (Vitest):** mode-inference rule (import sets client only from
  null; non-null untouched); chooser-visibility predicate (mode/path
  combinations); theme apply/boot resolution (explicit vs auto); backup UI
  handlers against the real `backup` module on fake-indexeddb (export
  stamps `lastBackupAt`; import replaces; invalid file → calm error);
  `ClientVisitsList` ordering/partition logic (upcoming vs past,
  cancelled flag) as pure functions; strings parity (existing pattern).
- **e2e (Playwright):** first-run chooser appears on a fresh profile,
  choice persists across reload; import-first flow lands in client mode
  without seeing the chooser; mode switch in Settings swaps the tab bar
  both ways; provider profile round-trips into the share payload; theme
  toggle flips `data-theme` and survives reload.

## Out of scope (→ sub-project 2 or later)

- Big-card client home (next visit, countdown), salons list, save-salon.
- Services editor (booking works by free-typing; presets UI later).
- Client-mode backup / backup format v2 including `received`.
- `.ics` / add-to-calendar (#8). Robustness passes (#9).
