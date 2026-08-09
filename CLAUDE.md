# when-again — project conventions

Free, open-source, **no-backend** appointment-reminder PWA. A provider (e.g. a
hairdresser) keeps a schedule and client visit history on their own phone; each
appointment is handed to the client's phone via a QR code or share link, with
add-to-calendar for reminders. Static hosting serves only code — no user data
ever reaches a server.

## Architecture: modulith

- `src/app/` is the composition root (entry, router assembly, service-worker
  registration, global CSS). **Nothing imports `src/app/`.**
- Every other piece of code lives in `src/modules/<name>/` and exposes a public
  API through its `index.ts`. **Cross-module imports go through `index.ts`
  only — never reach into another module's internals.**
- The dependency graph stays **acyclic**. `db`, `time`, and `i18n` are leaves.
  Entity modules (`appointments`, `clients`, `settings`) sit low; UI modules
  (`booking`, `share`, `visits`) sit high. `db` holds store names/indexes only,
  no entity types — each entity module owns its own type.
- There is no `shared/` or `utils/` folder. A widget lives in the module that
  needs it first; promote it to its own module only when a second consumer
  appears.

## Stack & tooling

- React + Vite + TanStack Router, TypeScript **strict**. SPA, no SSR.
- Package manager: **npm** (`npm ci` in CI). Commit `package-lock.json`.
- TypeScript is pinned `~6.0.3` — typescript-eslint's peer ceiling is `<6.1.0`
  and TS 7 is unsupported by it. Do not loosen the pin.
- Storage: IndexedDB via `idb`; unit tests use `fake-indexeddb`.
- Styling: **Tailwind CSS v4** via `@tailwindcss/vite` — utilities in JSX, no
  per-module CSS files. Design tokens live in `src/app/index.css` behind
  `@theme inline`; that file (plus self-hosted fonts, imported in
  `src/app/main.tsx`) is the only CSS in `src/`. Dark mode is a **token
  flip** — no `dark:` variants anywhere. No `@apply` component-class layer:
  compose utilities directly, promote a repeated combination to a component
  only when the module needs one. Fonts are self-hosted via `@fontsource`
  (Lora + IBM Plex Sans, Latin+Cyrillic subsets) — never load fonts from a
  CDN.
- Tests: **Vitest** for module logic (`src/**/*.test.ts`), **Playwright** for
  end-to-end smoke (`e2e/`). Both run in CI.
- Lint/format: ESLint (flat config) + Prettier, with `prettier-plugin-tailwindcss`
  ordering Tailwind classes. `.superpowers/`, `docs/design/`, `docs/plans/`, and
  `docs/specs/` are in `.prettierignore`.

## Hosting & base path

- GitHub Pages, deployed by GitHub Actions on push to `main`, **zero secrets**.
- The app lives under `/when-again/`. The single source of truth for the base
  path is `base` in `vite.config.ts` (overridable via the `BASE_PATH` env var);
  app code reads `import.meta.env.BASE_URL`. **Never hardcode `/when-again/` in
  app code.** In `index.html`, icon/asset hrefs must be root-relative (leading
  slash) so Vite rewrites them against the base.
- A future custom domain is a config change only (`BASE_PATH=/`). Keep it
  configurable.

## Data & time semantics

- Appointments store a **wall-clock** time: `{ dateTime: 'YYYY-MM-DDTHH:mm',
timeZone: <IANA name> }`. Never store epoch/UTC for appointment starts —
  "15:00" means 15:00 at the provider's location.
- Backup is a single JSON file `{ app, version, exportedAt, settings, clients,
appointments }`; import validates then replaces. IDs are `crypto.randomUUID()`.

## Writing conventions

- Simplified Technical English (the `ste-writing` skill) applies to
  **user-facing copy only** — README, app UI strings, error messages, published
  docs. Not to specs, plans, issue bodies, commit messages, or this file.
- Commit messages and PR bodies: **never** include a Claude session link. A
  "Generated with Claude Code" attribution line is fine.

## Process

- Work is tracked as epics on the GitHub project board (issues #1–#10). Each
  epic runs its own cycle: written plan → subagent-driven implementation →
  per-task review → whole-branch review → merge.
- Specs live in `docs/specs/`, implementation plans in `docs/plans/`.
- Brainstorm before planning the epics with real open design questions — the
  handoff epic (#6) and the UI epics (#4, #7). The data/infrastructure epics
  were fully specified and did not need it.
- Some cross-epic decisions are deferred deliberately; check the project's auto
  memory (loaded at session start) for the current list before building on the
  data layer or backup.
