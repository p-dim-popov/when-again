# Restyle + Tailwind v4 Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all seven per-module `.css` files with Tailwind v4 utilities
and restyle the app to the approved "Elevated & warm" look, with no behavior,
routing, data, or module-boundary changes.

**Architecture:** Semantic design tokens are CSS variables on `:root` (with
`prefers-color-scheme` + `[data-theme]` overrides), mapped into Tailwind via
`@theme inline` so utilities emit `var(--token)` and dark mode is a token flip —
no `dark:` variants. Components carry styles as utilities in JSX; the token
stylesheet + fonts live in `src/app/` (composition root).

**Tech Stack:** Tailwind CSS v4 + `@tailwindcss/vite`, `@fontsource/lora` +
`@fontsource/ibm-plex-sans` (self-hosted woff2, Latin+Cyrillic),
`prettier-plugin-tailwindcss`. React 19 + Vite + TanStack unchanged.

**Reference:** design spec `docs/specs/2026-08-09-restyle-tailwind-migration.md`;
approved Direction 1 mockup (artifact). Each component's *current* `.css` is the
source of its layout/behavior; the spec's "component treatments" + mockup are the
source of its new look.

## Verification model (all tasks)

Every task ends by confirming, from the repo root:

```bash
npm run lint && npm run format:check && npm run typecheck && npm run build
npm run test        # 114 unit, must stay green
npm run test:e2e    # 7 e2e, must stay green
```

…plus a **visual check** in a 390×844 phone viewport, **light and dark**, against
the mockup. (Dark toggled via `:root[data-theme="dark"]`; the CDP path from the
session audit works: `emulate` viewport, `evaluate_script` for overflow, iframe
harness in `public/` for claude-in-chrome screenshots — remove the harness before
committing.) Behavior is unchanged, so no test should need editing; if one does,
stop — that means a DOM/role/behavior change slipped in.

**Interim roughness is expected:** once Tailwind's preflight lands (Task 1),
not-yet-migrated screens may show minor default-reset glitches until their task
runs. The bar is the *final* state per task, not a pristine intermediate.

## Global Constraints

Every task inherits these (from the spec / CLAUDE.md); exact values must not drift.

- Offline / no backend / static hosting. **No CDN or runtime network fetch.**
  Tailwind is build-time; fonts are **self-hosted woff2** (via `@fontsource`,
  bundled by Vite).
- **Base path configurable** (`import.meta.env.BASE_URL`; `base` in
  `vite.config.ts`). Never hardcode `/when-again/`; asset URLs resolve against
  the base.
- **BG + EN** → bundled fonts must cover **Latin + Cyrillic**.
- **TypeScript strict**; `typescript` pinned `~6.0.3` (do not loosen). **npm**;
  commit `package-lock.json`.
- **Modulith:** cross-module imports via `index.ts`; acyclic; `src/app/` is the
  composition root (home of the token stylesheet). No new cross-module edges; no
  `shared/`/`utils/`.
- **Touch targets ≥ 44px.**
- Green suite (`lint`, `format:check`, `typecheck`, `build`, 114 unit, 7 e2e) at
  every task boundary.
- **No `dark:` variants** anywhere — dark is a token flip. **No `@apply`
  component-class layer** — utilities in JSX, with `@utility`/`@layer` only for
  what utilities can't express.

---

## File Structure

- `src/app/index.css` — grows into the Tailwind entry: `@import "tailwindcss"`,
  token `:root`/dark blocks, `@theme inline`, `@font-face` (via `@fontsource`
  imports), base layer, and the few `@utility`/`@layer` extras.
- `src/app/main.tsx` — imports `@fontsource` subset CSS.
- `vite.config.ts` — add `@tailwindcss/vite` plugin.
- `.prettierrc*` — add `prettier-plugin-tailwindcss`.
- Deleted at their task: `shell/AppShell.css`, `schedule/ScheduleScreen.css`,
  `schedule/TimePicker.css`, `booking/AppointmentForm.css`,
  `booking/MonthPicker.css`, `booking/ShareLanding.css`.
- `CLAUDE.md` — convention update (Task 7).

---

### Task 1: Tailwind foundation — install, tokens, theme, fonts, base

**Files:**
- Modify: `package.json`, `vite.config.ts`, `.prettierrc` (or `package.json`
  prettier field — match what exists)
- Modify: `src/app/index.css` (becomes the Tailwind entry), `src/app/main.tsx`
- No component conversion in this task.

**Produces (later tasks depend on these):**
- Utilities generated from `@theme inline` token map — later tasks use these
  names, not raw hex:
  - color: `bg-bg bg-surface bg-surface-2 text-ink text-muted text-faint
    border-line bg-accent text-accent text-accent-ink bg-accent-soft
    border-accent-line text-gold border-gold bg-danger text-danger
    border-danger-line text-on-accent` (and the symmetric `bg-*`/`text-*`/
    `border-*` forms).
  - font: `font-serif` (Lora), `font-sans` (IBM Plex Sans).
  - radius: `rounded-sm2` (9px), `rounded-card` (13px), `rounded-chip` (11px).
  - shadow: `shadow-card`, `shadow-fab`.
- Dark mode is automatic via token flip — later tasks add **no** `dark:`
  variants.

- [ ] **Step 1: Install dependencies**

```bash
npm install tailwindcss @tailwindcss/vite
npm install @fontsource/lora @fontsource/ibm-plex-sans
npm install -D prettier-plugin-tailwindcss
```

- [ ] **Step 2: Add the Vite plugin**

In `vite.config.ts`, import and add to `plugins` (keep `base` and existing
plugins):

```typescript
import tailwindcss from '@tailwindcss/vite'
// plugins: [react(), tailwindcss()]  // keep the existing react plugin
```

- [ ] **Step 3: Add the Prettier plugin**

Add `"prettier-plugin-tailwindcss"` to the Prettier `plugins` list (in whatever
Prettier config the repo uses). Run `npm run format` once so class ordering is
canonical from here on.

- [ ] **Step 4: Import font subsets**

In `src/app/main.tsx`, import the Latin + Cyrillic subsets for the weights used
(Lora 500/600 for headings; Plex 400/500/600 for UI). Example:

```typescript
import '@fontsource/lora/cyrillic-500.css'
import '@fontsource/lora/cyrillic-600.css'
import '@fontsource/lora/latin-500.css'
import '@fontsource/lora/latin-600.css'
import '@fontsource/ibm-plex-sans/cyrillic-400.css'
import '@fontsource/ibm-plex-sans/cyrillic-500.css'
import '@fontsource/ibm-plex-sans/cyrillic-600.css'
import '@fontsource/ibm-plex-sans/latin-400.css'
import '@fontsource/ibm-plex-sans/latin-500.css'
import '@fontsource/ibm-plex-sans/latin-600.css'
```

(Confirm these subset files exist in the installed packages; if the package
layout differs, import the equivalent weight+subset files it ships.)

- [ ] **Step 5: Author the entry CSS**

Replace `src/app/index.css` with the Tailwind entry — tokens (light), dark
overrides (media + `[data-theme]`), `@theme inline` mapping, base layer. Use the
exact token values from the spec's color table.

```css
@import "tailwindcss";

:root {
  --bg:#efebe2; --surface:#fbfaf6; --surface-2:#f4f1e9;
  --ink:#16211c; --muted:#6b7a72; --faint:#9aa79e; --line:#e4ded1;
  --accent:#0e5a48; --accent-ink:#0b4638; --accent-soft:#e5ede7; --accent-line:#cfe0d6;
  --gold:#c9a96a; --danger:#c0504c; --danger-line:#e2c3c3; --on-accent:#fbfaf6;
  --sh-card:0 1px 2px rgba(22,33,28,.05), 0 14px 30px -20px rgba(22,33,28,.22);
  --sh-fab:0 10px 20px -6px color-mix(in srgb, var(--accent) 55%, transparent);
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg:#0f1512; --surface:#171d19; --surface-2:#131815;
    --ink:#e9ede9; --muted:#97a29b; --faint:#6c766f; --line:#262d28;
    --accent:#58b899; --accent-ink:#bfe3d5; --accent-soft:#17251f; --accent-line:#294138;
    --gold:#cbb079; --danger:#e08a87; --danger-line:#5a3435; --on-accent:#0f1512;
    --sh-card:0 1px 2px rgba(0,0,0,.4), 0 16px 34px -20px rgba(0,0,0,.7);
  }
}
:root[data-theme="light"] { color-scheme: light; /* light values, same as :root */ }
:root[data-theme="dark"]  { color-scheme: dark;  /* dark values, same as the media block */ }

@theme inline {
  --color-bg: var(--bg);
  --color-surface: var(--surface);
  --color-surface-2: var(--surface-2);
  --color-ink: var(--ink);
  --color-muted: var(--muted);
  --color-faint: var(--faint);
  --color-line: var(--line);
  --color-accent: var(--accent);
  --color-accent-ink: var(--accent-ink);
  --color-accent-soft: var(--accent-soft);
  --color-accent-line: var(--accent-line);
  --color-gold: var(--gold);
  --color-danger: var(--danger);
  --color-danger-line: var(--danger-line);
  --color-on-accent: var(--on-accent);
  --font-serif: "Lora", Georgia, serif;
  --font-sans: "IBM Plex Sans", system-ui, sans-serif;
  --radius-sm2: 9px;
  --radius-card: 13px;
  --radius-chip: 11px;
  --shadow-card: var(--sh-card);
  --shadow-fab: var(--sh-fab);
}

@layer base {
  html { -webkit-text-size-adjust: 100%; }
  body { margin: 0; min-height: 100dvh; background: var(--bg); color: var(--ink);
    font-family: var(--font-sans); -webkit-font-smoothing: antialiased; }
}
```

Duplicate the light values into `[data-theme="light"]` and the dark values into
`[data-theme="dark"]` (verbatim from the two blocks above) so a manual toggle
beats the OS. The old `:root{font-family/color/background}` and `main{...}` rules
in this file are removed (the `main` rule is unused; `.appShell` owns layout).

- [ ] **Step 6: Verify**

```bash
npm run lint && npm run format:check && npm run typecheck && npm run build
npm run test && npm run test:e2e
```

Expected: all green. Load the app (dev server) — it still renders via the
existing component `.css` files; confirm the Cyrillic BG strings render in Lora /
IBM Plex Sans (switch language on `/settings`). Interim preflight glitches on
component screens are acceptable and get fixed in Tasks 2–6.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "build: add Tailwind v4, self-hosted fonts, and the token theme layer"
```

---

### Task 2: Convert `shell` (AppShell, tabs, FAB) + retire global CSS

**Files:**
- Modify: `src/modules/shell/AppShell.tsx`
- Delete: `src/modules/shell/AppShell.css`

**Interfaces:**
- Consumes: the token utilities + `font-serif`/`font-sans` from Task 1.
- Produces: the app frame (`.appShell` layout wrapper, bottom tab bar, FAB) in
  the new look — the visual baseline every screen sits in.

- [ ] **Step 1: Convert AppShell to utilities**

Rewrite `AppShell.tsx`'s markup with Tailwind utilities, porting every rule from
`AppShell.css` and applying the spec's tab/FAB treatment. The token definitions
that were in `AppShell.css` are gone (now in `src/app/index.css`); `.appShell`
keeps only its layout role (`flex flex-col min-h-dvh bg-bg text-ink`). Remove the
`import './AppShell.css'`. Representative mappings:
- tab bar: `sticky bottom-0 z-10 grid grid-cols-4 items-end border-t border-line
  bg-surface px-1.5 py-2`
- active tab: `text-accent font-semibold` (via the existing `data-status`/active
  logic — keep the logic, restyle the output)
- FAB: `size-12 rounded-full bg-accent text-on-accent grid place-items-center
  text-2xl -translate-y-3.5 shadow-fab border-[3px] border-surface`

- [ ] **Step 2: Delete the CSS file**

```bash
git rm src/modules/shell/AppShell.css
```

- [ ] **Step 3: Verify** (per the verification model). Visual: tab bar + FAB,
  active state, both themes, safe-area bottom inset intact.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "refactor(shell): convert AppShell to Tailwind, apply Elevated & warm"
```

---

### Task 3: Convert `schedule/ScheduleScreen` (day view)

**Files:**
- Modify: `src/modules/schedule/ScheduleScreen.tsx`
- Delete: `src/modules/schedule/ScheduleScreen.css`

**Interfaces:**
- Consumes: Task 1 utilities; the app frame from Task 2.
- Produces: the restyled day view (app bar / month-jump button, week strip,
  appointment cards, gap chips).

- [ ] **Step 1: Convert to utilities**, porting `ScheduleScreen.css` and applying
  the spec treatments. Key points:
  - **Month-jump date button** gets a clear pressable affordance
    (`bg-surface border border-line rounded-sm2 px-3 py-1` + caret), resolving
    **#17 item 7**. Keep its `aria-label` and `onClick`.
  - Date heading in `font-serif`; relative-day line in `text-faint`.
  - Week strip: active day `bg-accent text-on-accent rounded-sm2`.
  - Appointment card: `bg-surface border border-line rounded-card shadow-card`
    with a **gold left edge** (`border-l-[3px] border-gold`); cancelled =
    de-emphasised (`text-muted`, no gold), keep the cancelled tag.
  - Gap chips: `text-accent-ink bg-surface-2 border border-line rounded-chip`,
    **≥44px** (`min-h-11 px-3`); "other time" chip muted + dashed border.
  - Keep the "more…" stub control and all handlers/DOM roles exactly as-is
    (its removal is #17 item 2, not this task) — just restyle it.
- [ ] **Step 2:** `git rm src/modules/schedule/ScheduleScreen.css`
- [ ] **Step 3: Verify.** Visual: day view with an appointment + free gaps, both
  themes; confirm chips and the date button are ≥44px.
- [ ] **Step 4: Commit** — `refactor(schedule): convert ScheduleScreen to Tailwind`

---

### Task 4: Convert `schedule/TimePicker` ("other time" sheet)

**Files:**
- Modify: `src/modules/schedule/TimePicker.tsx`
- Delete: `src/modules/schedule/TimePicker.css`

**Interfaces:**
- Consumes: Task 1 utilities.
- Produces: the restyled bottom sheet (behavior unchanged — still the stepper;
  the scroll-snap rebuild is #17 item 3).

- [ ] **Step 1: Convert to utilities**, porting `TimePicker.css`, applying the
  sheet treatment (spec): `fixed inset-x-0 bottom-0 z-30 bg-surface rounded-t-[22px]
  shadow-card px-4 pt-2.5` + safe-area bottom padding, the selection band in
  `bg-accent-soft border border-accent-line`, save button filled accent. The
  scrim + stepper structure/handlers stay identical. Safe-area inset:
  `pb-[calc(1rem+env(safe-area-inset-bottom))]` (arbitrary value is fine).
- [ ] **Step 2:** `git rm src/modules/schedule/TimePicker.css`
- [ ] **Step 3: Verify.** Open the sheet from a gap; both themes; sheet sits over
  the tab bar; save works.
- [ ] **Step 4: Commit** — `refactor(schedule): convert TimePicker to Tailwind`

---

### Task 5: Convert `booking/AppointmentForm`

**Files:**
- Modify: `src/modules/booking/AppointmentForm.tsx`
- Delete: `src/modules/booking/AppointmentForm.css`

**Interfaces:**
- Consumes: Task 1 utilities.
- Produces: the restyled form. Its correct grid + input sizing **resolves #17
  items 6a (overflow) and 6b (tap targets)**.

- [ ] **Step 1: Convert to utilities**, porting `AppointmentForm.css`, applying
  the spec's input/button treatments. Correctness requirements baked in:
  - **Inputs fill their padded box** and are **≥44px** — the `<input>` gets the
    height/padding (e.g. the field wrapper is `flex items-center gap-2 min-h-11
    rounded-card border border-line bg-surface px-3`, and the `<input>` is
    `flex-1 min-w-0 bg-transparent outline-none`), so the whole box is the target
    (fixes #17 6b). Focus ring in `accent`.
  - **Duration/Price row:** `grid grid-cols-2 gap-2.5`, and each field/`input`
    carries `min-w-0` so the number inputs can't floor the tracks — **no
    horizontal overflow at 390px** (fixes #17 6a).
  - Title in `font-serif`; micro-labels uppercase `text-faint`; primary
    "Save · share" `w-full min-h-12 rounded-card bg-accent text-on-accent
    font-semibold shadow-fab`; cancel uses `text-danger`/`border-danger-line`.
  - Client/service suggestion listboxes + all combobox/option roles, the
    create-client button, and every handler stay identical (the dropdown-close
    and auto-create logic are #17 items 4 & 5 — not this task).
- [ ] **Step 2:** `git rm src/modules/booking/AppointmentForm.css`
- [ ] **Step 3: Verify.** Visual + **explicitly measure**: at 390px the form has
  `document.documentElement.scrollWidth - clientWidth === 0` (no sideways
  scroll), and inputs report ≥44px height. Both themes.
- [ ] **Step 4: Commit** — `refactor(booking): convert AppointmentForm to Tailwind`

---

### Task 6: Convert `booking/MonthPicker` + `booking/ShareLanding`

**Files:**
- Modify: `src/modules/booking/MonthPicker.tsx`, `src/modules/booking/ShareLanding.tsx`
- Delete: `src/modules/booking/MonthPicker.css`, `src/modules/booking/ShareLanding.css`

**Interfaces:**
- Consumes: Task 1 utilities.
- Produces: the last two screens in the new look. No shared interface downstream.

- [ ] **Step 1:** Convert both components' markup to utilities, porting each
  `.css` and applying the tokens/treatments consistently (calendar day cells stay
  ≥44px — already 49px; keep it). Remove both CSS imports.
- [ ] **Step 2:** `git rm src/modules/booking/MonthPicker.css
  src/modules/booking/ShareLanding.css`
- [ ] **Step 3: Verify.** Visual: month picker (grid, month arrows, selected
  day) + share landing, both themes.
- [ ] **Step 4: Commit** — `refactor(booking): convert MonthPicker and ShareLanding to Tailwind`

---

### Task 7: Finish — sweep, docs, issue update

**Files:**
- Modify: `CLAUDE.md`
- Verify-only: whole tree

- [ ] **Step 1: Sweep for leftovers**

```bash
find src -name "*.css"                 # expect ONLY src/app/index.css
grep -rn "import './" src --include="*.tsx" | grep '\.css'   # expect no matches
grep -rn "className=\"[^\"]*[a-z]-[a-z].*\"" src | grep -iE "schedule-|apptForm-|month-|share-|appShell(?!)" || true
```

Resolve any stray `.css` import or leftover legacy class name.

- [ ] **Step 2: Update CLAUDE.md**

In the "Stack & tooling" / writing conventions, replace the per-module-CSS
description with the Tailwind convention: Tailwind v4 utilities in JSX; tokens +
`@theme inline` in `src/app/index.css`; no `dark:` variants (token flip); no
`@apply` layer; `prettier-plugin-tailwindcss` orders classes. Keep the
`.superpowers` in `.prettierignore` note.

- [ ] **Step 3: Update issue #17**

Comment on #17 that items **6** (mobile overflow + tap targets) and **7**
(month-header affordance) are resolved by this migration, leaving items **1–5**
(behavioral) for the follow-up cycle.

```bash
gh issue comment 17 --repo p-dim-popov/when-again --body "Items 6 (Duration/Price overflow + sub-44px tap targets) and 7 (month-header affordance) are resolved by the Tailwind restyle (branch tailwind-restyle) — those are pure styling and were rebuilt correctly. Remaining scope here: items 1–5 (behavioral)."
```

- [ ] **Step 4: Final verification** — full green suite + a visual pass across
  **every** screen (day view, time sheet, form, month picker, share landing,
  settings, clients placeholder) in **both themes** at 390px. Confirm no `.css`
  outside `src/app/`.

- [ ] **Step 5: Commit** — `docs: adopt Tailwind convention in CLAUDE.md`

---

## Self-Review

- **Spec coverage:** tokens (T1), dark flip (T1), fonts (T1), utilities-in-JSX
  (all), delete 7 `.css` (T2–T6), every component restyled (T2–T6), #17 6/7
  resolved (T3/T5), CLAUDE.md (T7). Covered.
- **Deferred correctly:** #17 items 1–5 (behavioral) are explicitly *not* touched
  (day arrows, "more…" removal, scroll-snap rebuild, dropdown-close, auto-create)
  — each task says "keep handlers/DOM/roles identical."
- **Type consistency:** utility/token names introduced in Task 1's "Produces" are
  the exact names used in Tasks 2–6.
- **Risk:** if `@fontsource` subset filenames differ from Step 4's list, import
  the equivalent weight+subset files the package actually ships (checked in T1
  Step 6's visual verify).
