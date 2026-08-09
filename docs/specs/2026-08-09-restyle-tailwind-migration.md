# Restyle + Tailwind v4 Migration — Design Spec

**Status:** design approved (Direction 1 chosen 2026-08-09) — pending spec review.

**Goal:** Move all styling from the seven per-module `.css` files to Tailwind
v4, and in the same pass restyle the app to a more professional **"Elevated &
warm"** look. One branch, one PR. No behavior, routing, data, or module-boundary
changes.

**Approach:** Semantic design tokens become Tailwind theme variables via
`@theme inline`; components carry styles as utility classes in JSX; dark mode is
a token flip (no `dark:` variants). The visual language is applied to every
component, not just the two screens that were mocked.

---

## Global Constraints

Every task inherits these. Exact values are copied from the project (CLAUDE.md,
founding spec) and must not drift.

- **Offline / no backend / static hosting.** Tailwind is build-time only (zero
  runtime). **No CDN or network fetch** for anything — fonts are **self-hosted
  woff2**, bundled by Vite.
- **Base path is configurable** via `import.meta.env.BASE_URL` (source of truth
  `base` in `vite.config.ts`, `BASE_PATH` override). Never hardcode
  `/when-again/`. Font/asset URLs must resolve against the base.
- **Bilingual BG + EN** → every bundled font **must cover Latin *and*
  Cyrillic**. This rules out most display serifs.
- **TypeScript strict**, `typescript` pinned `~6.0.3` (do not loosen). Package
  manager **npm**; commit `package-lock.json`.
- **Modulith:** cross-module imports through `index.ts` only; graph stays
  acyclic; `src/app/` is the composition root and the correct home for the
  global token stylesheet. No new cross-module edges; no `shared/`/`utils/`.
- **Touch targets ≥ 44px** for every interactive control.
- **Green suite stays green** at every task boundary: `lint`, `format:check`,
  `typecheck`, `build`, **114 unit**, **7 e2e**.

---

## Scope

**In scope**
- Install Tailwind v4; delete all 7 `.css` files; restyle every component to the
  new design language; establish the token system, dark theme, fonts, and
  class-ordering tooling.
- Because this is a from-scratch CSS rewrite, the new styles are written
  *correctly*: this **resolves the styling-level items of #17** — the
  Duration/Price grid overflow (#17 item 6a), the sub-44px tap targets (6b), and
  the unclear month-header affordance (7). These are pure CSS and there is no
  sense re-creating the bugs.

**Out of scope (deferred to the #17 ceremony, after this merges)**
- All **behavioral** #17 items: day-arrows→weeks (1), removing the dead "more…"
  control (2), the scroll-snap time picker rebuild (3), the client-dropdown
  close logic (4), and auto-create-client-on-save (5). The current TimePicker
  stays a (restyled) stepper here; its scroll-snap rebuild is item 3.
- No new features, routes, queries, i18n strings, or data-model changes. No
  changes to TanStack Query/Form/Store, mutations, or module public APIs.

---

## Design language: "Elevated & warm"

Warm ivory neutrals, a deepened green accent, a restrained gold, serif headings,
hairline rules, and soft warm depth. Reference: the approved Direction 1 mockup.

### Color tokens

Semantic names (not raw hues). Same names light and dark; only values change.

| Token           | Light      | Dark       | Role |
|-----------------|-----------|-----------|------|
| `--bg`          | `#efebe2` | `#0f1512` | app background |
| `--surface`     | `#fbfaf6` | `#171d19` | cards, sheets, bars |
| `--surface-2`   | `#f4f1e9` | `#131815` | insets, chips-on-surface |
| `--ink`         | `#16211c` | `#e9ede9` | primary text |
| `--muted`       | `#6b7a72` | `#97a29b` | secondary text |
| `--faint`       | `#9aa79e` | `#6c766f` | labels, disabled |
| `--line`        | `#e4ded1` | `#262d28` | hairline borders/dividers |
| `--accent`      | `#0e5a48` | `#58b899` | primary actions, active |
| `--accent-ink`  | `#0b4638` | `#bfe3d5` | text/icon on soft accent |
| `--accent-soft` | `#e5ede7` | `#17251f` | active-slot fills, tints |
| `--accent-line` | `#cfe0d6` | `#294138` | accent borders |
| `--gold`        | `#c9a96a` | `#cbb079` | restrained secondary accent |
| `--danger`      | `#c0504c` | `#e08a87` | cancel/destructive |
| `--danger-line` | `#e2c3c3` | `#5a3435` | danger borders |
| `--on-accent`   | `#fbfaf6` | `#0f1512` | text on a filled accent |

Dark values are a starting point; tune against the live dark preview during
wiring (a token edit, no component churn).

**Gold is restrained:** the appointment-card left edge and small accents (a
price, a section hairline). Never a fill, never an action color.

**Shadows** (`--shadow` token, soft/warm): light
`0 1px 2px rgba(22,33,28,.05), 0 14px 30px -20px rgba(22,33,28,.22)`; dark
`0 1px 2px rgba(0,0,0,.4), 0 16px 34px -20px rgba(0,0,0,.7)`.

### Type

- **Headings — Lora** (warm editorial serif, Cyrillic-native): the day-view date
  heading and screen titles (e.g. "New appointment").
- **UI — IBM Plex Sans** (humanist, Cyrillic, distinctive but legible):
  everything else — body, labels, buttons, data.
- Both **self-hosted woff2**, subset to **Latin + Cyrillic** (+ the punctuation
  the UI uses). Recommended, confirm visually at wiring — swapping is just a
  `--font-*` change.
- **Numeric data** (times, durations, prices, week dates) uses
  `font-variant-numeric: tabular-nums`.
- Scale (rem): 30/23/19/16/14/12/10.5. Micro-labels are uppercase with
  `~0.1em` tracking. Headings get `text-wrap: balance`.

### Shape & depth

- Radius scale ~ `sm 9px / md 13px / chip 11px / pill 999px`. Warm, not sharp,
  not bubbly.
- Borders are **hairline** (`1px var(--line)`); dashed only for the "other time"
  affordance.
- Elevation is soft and sparing — cards and the FAB, not every surface.

### Component treatments (apply consistently everywhere)

- **App bar / date button:** the date in Lora; a clear pressable affordance on
  the month-jump control (surface + hairline + caret) so it reads as a button
  (resolves #17-7).
- **Week strip:** 7 columns, active day filled `--accent` with `--on-accent`.
- **Appointment card:** `--surface`, hairline, soft shadow, **`--gold` left
  edge**; cancelled = de-emphasised (muted, no gold).
- **Free-gap chips:** `--accent-ink` on `--surface-2`, hairline; the "other
  time" chip is muted with a dashed border. ≥44px.
- **Inputs:** the padded box *is* the target (input fills it, ≥44px), hairline,
  focus ring in `--accent`. The Duration/Price row is `grid-cols-2` with
  `min-w-0` tracks so it never overflows (resolves #17-6a).
- **Primary button ("Save · share"):** filled `--accent`, `--on-accent`, soft
  accent shadow, ≥48px.
- **Bottom tabs + FAB:** `--surface` bar, hairline top, active in `--accent`;
  FAB filled accent with a `color-mix` halo, ring in `--surface`.
- **Bottom sheet ("other time"):** `--surface`, top radius, warm drop shadow,
  scrim behind. (Restyled stepper for now; scroll-snap rebuild is #17-3.)

---

## Tailwind v4 architecture

### Setup

`npm install tailwindcss @tailwindcss/vite`. Add the plugin to
`vite.config.ts` (alongside the existing config; base path untouched). One entry
stylesheet at `src/app/index.css` begins with `@import "tailwindcss";`.

### Tokens → theme (the mechanism)

Semantic tokens are plain CSS variables on `:root`, overridden for dark, then
mapped into Tailwind with **`@theme inline`** so utilities emit `var(--token)`
directly and dark mode is a pure variable flip — **no `dark:` variants anywhere**.

```css
@import "tailwindcss";

:root {
  --bg: #efebe2; --surface: #fbfaf6; --ink: #16211c; --accent: #0e5a48;
  /* …all tokens (light)… */
}
@media (prefers-color-scheme: dark) {
  :root { --bg: #0f1512; --surface: #171d19; --ink: #e9ede9; --accent: #58b899; /* … */ }
}
:root[data-theme="light"] { /* light values — manual toggle beats the OS */ }
:root[data-theme="dark"]  { /* dark values  — manual toggle beats the OS */ }

@theme inline {
  --color-bg: var(--bg);
  --color-surface: var(--surface);
  --color-ink: var(--ink);
  --color-accent: var(--accent);
  /* …one --color-* per token → generates bg-surface, text-ink, border-line,
     text-accent, bg-danger, etc.… */
  --font-serif: "Lora", Georgia, serif;
  --font-sans: "IBM Plex Sans", system-ui, sans-serif;
}
```

This is the same three-layer theming the app already ships (base /
`prefers-color-scheme` / `[data-theme]`), just consolidated in `src/app/` — the
composition root — instead of scoped to `.appShell` in the `shell` module.
`.appShell` becomes a pure layout wrapper.

### Fonts

`@font-face` blocks in the entry CSS pointing at self-hosted woff2 (bundled as
Vite assets so they hash and respect the base path). Latin+Cyrillic subsets.
No `@import url(...)`, no CDN.

### Component styling pattern

**Utilities in JSX.** Repetition is absorbed by the existing per-widget React
components (`AppointmentBlock`, `GapRow`, `TimePicker`, form fields…). The few
things utilities can't express live as small `@utility`/`@layer` additions in
the entry CSS: keyframes, `env(safe-area-inset-*)`, the FAB `color-mix` halo,
and `100dvh` layout. No `@apply` component-class layer.

Add **`prettier-plugin-tailwindcss`** for canonical class ordering.

---

## Migration path

One branch (`tailwind-restyle`), one PR, module-by-module; delete each `.css`
as its component converts. Visual parity is *not* the bar (we are restyling) —
the Direction 1 mockup + live dark preview are the reference, and the test suite
guards behavior.

1. **Foundation** — install Tailwind + vite plugin + prettier plugin; author the
   entry CSS (tokens, `@theme inline`, fonts, base layer); bundle the woff2;
   convert `AppShell` (tabs/FAB) + the app-global `index.css`; delete
   `AppShell.css`. App renders in the new look, both themes.
2. **`schedule`** — `ScheduleScreen` + `TimePicker`; delete both `.css`.
3. **`booking`** — `AppointmentForm`, `MonthPicker`, `ShareLanding`; delete all
   three `.css`.
4. **Finish** — grep for stray `.css` imports/class names; update **CLAUDE.md**
   (replace the per-module-CSS convention with the Tailwind convention;
   `.prettierignore` note stays); update issue #17 to reflect that items 6 and 7
   are resolved here.

Each step keeps the full green suite and is checked in the phone viewport
(dark + light).

---

## Risks

- **Cyrillic coverage** — verify Lora + IBM Plex Sans render the BG strings
  before committing to them; keep Georgia/system-ui as the declared fallbacks.
- **Vite 8 + Tailwind v4 plugin** — confirm `@tailwindcss/vite` supports the
  pinned Vite 8 at install; the setup itself is the documented v4 path.
- **Visual regressions on unmocked screens** (MonthPicker, ShareLanding,
  Settings/Clients placeholders) — they follow the same tokens/treatments, but
  each gets its own phone-viewport check.
