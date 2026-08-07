# Epic 1: PWA Scaffolding & Deployment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An empty but real when-again app that installs to a phone home screen, loads offline, and auto-deploys from `main` to https://p-dim-popov.github.io/when-again/.

**Architecture:** Plain Vite SPA (no SSR, no server — ever), structured as a modulith: `src/app/` is the composition root (entry, router assembly, global css; nothing imports it), and all feature code lives in self-contained modules under `src/modules/<name>/` with an `index.ts` public API. Epic 1 creates `app/` plus the placeholder `home` module. vite-plugin-pwa provides the service worker (app-shell precache) and web manifest. GitHub Actions runs CI on every push/PR and deploys `dist/` to GitHub Pages from `main` with zero external secrets.

**Tech Stack:** TypeScript, React 19, Vite, @tanstack/react-router, vite-plugin-pwa, Vitest, Playwright, ESLint (flat config) + Prettier, npm, GitHub Actions, GitHub Pages.

## Global Constraints

- Package manager: **npm** (commit `package-lock.json`; CI uses `npm ci`).
- Base path: `/when-again/` by default, overridable via `BASE_PATH` env var at build time (future custom domain = config change only). Never hardcode the base in app code — the single source of truth is `base` in `vite.config.ts`; app code reads `import.meta.env.BASE_URL` directly (Vite guarantees it ends with `/`).
- No server code, no analytics, no external network calls at runtime.
- TypeScript `strict` everywhere.
- Repo root IS the app root (`~/Projects/when-again` — package.json sits next to README.md, docs/ stays as is).
- Working branch: create `epic-1-scaffolding` off `main`; commit per task; do NOT push to `main` directly until the finishing flow.
- Commit messages: no Claude session links. "Generated with Claude Code"/Co-Authored-By attribution is fine.
- User-facing UI strings are minimal placeholders in English for now (i18n is epic 2). Keep them in STE style: short, active, plain.
- Modulith rules: cross-module imports only via `modules/<name>/index.ts`; no dependency cycles between modules; nothing imports `src/app/`.

---

### Task 1: Vite + React + TypeScript scaffold

**Files:**

- Create: `package.json`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html`, `.gitignore`, `src/app/main.tsx`, `src/app/index.css`, `src/modules/home/HomeScreen.tsx`, `src/modules/home/index.ts`
- Test: none yet (build is the verification)

**Interfaces:**

- Consumes: nothing (first task).
- Produces: npm scripts `dev`, `build`, `preview`, `typecheck`; the `home` module exporting `HomeScreen` via `src/modules/home/index.ts`; Vite `base` resolved from `BASE_PATH` env with default `/when-again/`.

- [ ] **Step 1: Create branch**

```bash
cd ~/Projects/when-again && git checkout -b epic-1-scaffolding
```

- [ ] **Step 2: Write package.json**

```json
{
  "name": "when-again",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build && cp dist/index.html dist/404.html",
    "preview": "vite preview",
    "typecheck": "tsc -b"
  }
}
```

Note: `cp dist/index.html dist/404.html` is the GitHub Pages SPA fallback — Pages serves `404.html` for unknown paths, which lets deep links reach the router.

- [ ] **Step 3: Install dependencies**

```bash
npm install react react-dom
npm install -D typescript vite @vitejs/plugin-react @types/react @types/react-dom
```

- [ ] **Step 4: Write tsconfig.json**

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

- [ ] **Step 5: Write tsconfig.app.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "types": ["vite/client"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

- [ ] **Step 6: Write tsconfig.node.json**

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "composite": true
  },
  "include": ["vite.config.ts", "vitest.config.ts", "playwright.config.ts"]
}
```

- [ ] **Step 7: Write vite.config.ts**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Base path is configurable so a future custom domain (base '/') is a
// config change, not a refactor.
const base = process.env.BASE_PATH ?? '/when-again/';

export default defineConfig({
  base,
  plugins: [react()],
});
```

- [ ] **Step 8: Write index.html**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#1f2937" />
    <title>when-again</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/app/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 9: Write src/app/index.css**

```css
:root {
  font-family:
    system-ui,
    -apple-system,
    'Segoe UI',
    Roboto,
    sans-serif;
  color: #1f2937;
  background: #ffffff;
}

body {
  margin: 0;
  min-height: 100dvh;
}

main {
  padding: 2rem 1.25rem;
  max-width: 32rem;
  margin: 0 auto;
}
```

- [ ] **Step 10: Write the home module**

`src/modules/home/HomeScreen.tsx`:

```tsx
export function HomeScreen() {
  return (
    <main>
      <h1>when-again</h1>
      <p>Appointment reminders. No server. No accounts. No fees.</p>
    </main>
  );
}
```

`src/modules/home/index.ts`:

```ts
export { HomeScreen } from './HomeScreen';
```

- [ ] **Step 11: Write src/app/main.tsx**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HomeScreen } from '../modules/home';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HomeScreen />
  </StrictMode>,
);
```

- [ ] **Step 12: Write .gitignore**

```
node_modules
dist
dev-dist
test-results
playwright-report
*.local
```

- [ ] **Step 13: Verify build**

Run: `npm run build`
Expected: succeeds; `dist/index.html` and `dist/404.html` both exist. Check with `ls dist/index.html dist/404.html`.

- [ ] **Step 14: Verify dev server**

Run: `npm run dev -- --port 5173 &` then `curl -s http://localhost:5173/when-again/ | grep -o '<title>when-again</title>'`; kill the dev server after.
Expected: the title tag prints.

- [ ] **Step 15: Commit**

```bash
git add -A && git commit -m "feat: scaffold Vite + React + TypeScript app with configurable base path"
```

---

### Task 2: ESLint + Prettier

**Files:**

- Create: `eslint.config.js`, `.prettierrc.json`, `.prettierignore`
- Modify: `package.json` (scripts)

**Interfaces:**

- Consumes: Task 1 file layout.
- Produces: npm scripts `lint`, `format`, `format:check`. All later tasks must keep `npm run lint` green.

- [ ] **Step 1: Install dev dependencies**

```bash
npm install -D eslint @eslint/js typescript-eslint eslint-plugin-react-hooks eslint-config-prettier prettier
```

- [ ] **Step 2: Write eslint.config.js**

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'test-results', 'playwright-report'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  },
  prettier,
);
```

- [ ] **Step 3: Write .prettierrc.json**

```json
{
  "singleQuote": true
}
```

- [ ] **Step 4: Write .prettierignore**

```
dist
dev-dist
package-lock.json
```

- [ ] **Step 5: Add scripts to package.json**

Add to `"scripts"`:

```json
"lint": "eslint .",
"format": "prettier --write .",
"format:check": "prettier --check ."
```

- [ ] **Step 6: Format the repo and verify**

Run: `npm run format && npm run lint && npm run format:check`
Expected: all pass with no errors.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "chore: add ESLint (flat config) and Prettier"
```

---

### Task 3: Vitest wiring

**Files:**

- Create: `vitest.config.ts`
- Modify: `package.json` (script)

**Interfaces:**

- Consumes: nothing from the app.
- Produces: npm script `test`. Epic 1 has no unit-testable logic — `passWithNoTests` keeps the CI stage honest until the first real pure modules arrive (payload codec and .ics generator in later epics), which drop straight into `src/**/*.test.ts`.

- [ ] **Step 1: Install and configure Vitest**

```bash
npm install -D vitest
```

Write `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
  },
});
```

Add to `package.json` scripts: `"test": "vitest"`.

- [ ] **Step 2: Verify**

Run: `npm test -- --run`
Expected: exits 0 with "no test files found" (passWithNoTests).

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "chore: wire up Vitest (no unit-testable logic in epic 1 yet)"
```

---

### Task 4: TanStack Router

**Files:**

- Create: `src/app/router.tsx`
- Modify: `src/app/main.tsx`

**Interfaces:**

- Consumes: `HomeScreen` from the `home` module (Task 1), `import.meta.env.BASE_URL` (from Vite's `base` config, Task 1).
- Produces: `router` export from `src/app/router.tsx`; the route tree with `/` → HomeScreen. Future modules contribute their routes here.

- [ ] **Step 1: Install**

```bash
npm install @tanstack/react-router
```

- [ ] **Step 2: Write src/app/router.tsx**

```tsx
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from '@tanstack/react-router';
import { HomeScreen } from '../modules/home';

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomeScreen,
});

const routeTree = rootRoute.addChildren([homeRoute]);

export const router = createRouter({
  routeTree,
  basepath: import.meta.env.BASE_URL,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
```

- [ ] **Step 3: Modify src/app/main.tsx to use the router**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './router';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: all pass.
Then: `npm run preview -- --port 4173 &`, `curl -s http://localhost:4173/when-again/ | grep -o '<div id="root">'`, kill preview.
Expected: root div present (client renders Home at `/when-again/`).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add TanStack Router with base-path-aware routing"
```

---

### Task 5: PWA — service worker, manifest, icons

**Files:**

- Create: `public/logo.svg` (icon source; generated PNGs land in `public/`)
- Modify: `vite.config.ts`, `index.html`, `package.json`

**Interfaces:**

- Consumes: `base` constant in `vite.config.ts` (Task 1).
- Produces: `dist/sw.js`, `dist/manifest.webmanifest`, icon files referenced by the manifest. Task 6 asserts the manifest link tag.

- [ ] **Step 1: Install**

```bash
npm install -D vite-plugin-pwa
```

- [ ] **Step 2: Write public/logo.svg**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#1f2937"/>
  <rect x="96" y="144" width="320" height="272" rx="32" fill="#ffffff"/>
  <rect x="96" y="144" width="320" height="72" rx="32" fill="#f59e0b"/>
  <rect x="96" y="184" width="320" height="32" fill="#f59e0b"/>
  <circle cx="256" cy="316" r="60" fill="#1f2937"/>
  <path d="M256 284v32l22 22" stroke="#ffffff" stroke-width="16" stroke-linecap="round" fill="none"/>
</svg>
```

- [ ] **Step 3: Generate icons**

```bash
npx @vite-pwa/assets-generator --preset minimal-2023 public/logo.svg
```

Expected: `public/pwa-192x192.png`, `public/pwa-512x512.png`, `public/maskable-icon-512x512.png`, `public/apple-touch-icon-180x180.png`, `public/favicon.ico` (names per the minimal-2023 preset — verify with `ls public/`).

- [ ] **Step 4: Add the PWA plugin to vite.config.ts**

Replace the file content with:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Base path is configurable so a future custom domain (base '/') is a
// config change, not a refactor.
const base = process.env.BASE_PATH ?? '/when-again/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'when-again',
        short_name: 'when-again',
        description: 'Appointment reminders. No server. No accounts. No fees.',
        theme_color: '#1f2937',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
});
```

(vite-plugin-pwa derives `start_url` and `scope` from `base` automatically.)

- [ ] **Step 5: Add icon links to index.html `<head>`**

```html
<link rel="icon" href="favicon.ico" sizes="48x48" />
<link rel="icon" href="logo.svg" type="image/svg+xml" />
<link rel="apple-touch-icon" href="apple-touch-icon-180x180.png" />
```

(Relative hrefs — Vite rewrites them against `base`. If Step 3 produced different file names, match them here and in the manifest.)

- [ ] **Step 6: Verify the build emits the PWA artifacts**

Run: `npm run build && ls dist/sw.js dist/manifest.webmanifest`
Expected: both files exist. Also `grep -o '"start_url":"[^"]*"' dist/manifest.webmanifest` shows `/when-again/`.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: add PWA manifest, icons, and service worker via vite-plugin-pwa"
```

---

### Task 6: Playwright smoke tests

**Files:**

- Create: `playwright.config.ts`, `e2e/smoke.spec.ts`
- Modify: `package.json` (script)

**Interfaces:**

- Consumes: `npm run build` + `npm run preview` (Tasks 1/5), Home heading text (Task 1).
- Produces: npm script `test:e2e`; the `e2e/` directory pattern all later epics extend.

- [ ] **Step 1: Install**

```bash
npm install -D @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: Write playwright.config.ts**

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  use: {
    baseURL: 'http://localhost:4173',
  },
  webServer: {
    command: 'npm run preview -- --port 4173',
    url: 'http://localhost:4173/when-again/',
    reuseExistingServer: !process.env.CI,
  },
});
```

Note: `webServer` runs `preview` only — run `npm run build` before `test:e2e` (CI does this; the script chains it locally).

- [ ] **Step 3: Write e2e/smoke.spec.ts**

```ts
import { expect, test } from '@playwright/test';

test('the app shell renders the Home screen', async ({ page }) => {
  await page.goto('/when-again/');
  await expect(page.getByRole('heading', { name: 'when-again' })).toBeVisible();
});

test('the page declares the web app manifest', async ({ page }) => {
  await page.goto('/when-again/');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    'href',
    /manifest\.webmanifest/,
  );
});
```

- [ ] **Step 4: Add script**

Add to `package.json` scripts: `"test:e2e": "npm run build && playwright test"`.

- [ ] **Step 5: Run and verify**

Run: `npm run test:e2e`
Expected: 2 passing.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "test: add Playwright smoke tests for the app shell"
```

---

### Task 7: CI workflow

**Files:**

- Create: `.github/workflows/ci.yml`

**Interfaces:**

- Consumes: npm scripts `lint`, `format:check`, `typecheck`, `test`, `test:e2e` (Tasks 2/3/6).
- Produces: a `CI` workflow that must be green before merge; Task 8's deploy workflow sits beside it.

- [ ] **Step 1: Write .github/workflows/ci.yml**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run format:check
      - run: npm run typecheck
      - run: npm test -- --run
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
```

- [ ] **Step 2: Commit and push the branch**

```bash
git add -A && git commit -m "ci: add lint, typecheck, unit, and e2e workflow"
git push -u origin epic-1-scaffolding
```

- [ ] **Step 3: Verify CI runs green on the branch**

Open a draft PR so the workflow triggers, then watch it:

```bash
gh pr create --draft --title "Epic 1: PWA scaffolding & deployment" --body "Implements epic #1. Closes #1."
gh pr checks --watch
```

Expected: the CI check passes. Fix and re-push if not.

---

### Task 8: GitHub Pages deployment

**Files:**

- Create: `.github/workflows/deploy.yml`
- Modify: `README.md` (Status section)

**Interfaces:**

- Consumes: `npm run build` output `dist/` (Tasks 1/5); GitHub Pages enabled with `build_type=workflow`.
- Produces: the live app at https://p-dim-popov.github.io/when-again/, redeployed on every push to `main`.

- [ ] **Step 1: Enable GitHub Pages (Actions source)**

```bash
gh api -X POST repos/p-dim-popov/when-again/pages -f build_type=workflow
```

Expected: HTTP 201. If it already exists: `gh api -X PUT repos/p-dim-popov/when-again/pages -f build_type=workflow`.

- [ ] **Step 2: Write .github/workflows/deploy.yml**

```yaml
name: Deploy

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 3: Update the README Status section**

Replace the Status section body with:

```markdown
The app shell is live at
[p-dim-popov.github.io/when-again](https://p-dim-popov.github.io/when-again/).
The founding spec is
[`docs/specs/2026-08-07-when-again-design.md`](docs/specs/2026-08-07-when-again-design.md).
The GitHub issues and the project board track the work as epics.
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "ci: deploy to GitHub Pages from main"
git push
```

- [ ] **Step 5: Merge and verify the live deployment**

This step runs through the finishing flow (superpowers:finishing-a-development-branch — mark the PR ready, merge into main). After the merge:

```bash
gh run watch $(gh run list --workflow Deploy --limit 1 --json databaseId -q '.[0].databaseId')
curl -s https://p-dim-popov.github.io/when-again/ | grep -o '<title>when-again</title>'
curl -s https://p-dim-popov.github.io/when-again/manifest.webmanifest | grep -o '"name":"when-again"'
```

Expected: Deploy workflow succeeds; both curls print their match.

- [ ] **Step 6: Manual phone verification (user-assisted, closes the epic)**

On an Android phone: open https://p-dim-popov.github.io/when-again/ in Chrome → menu → "Add to Home screen" → confirm the icon appears and the app opens standalone. Then enable airplane mode and reopen — the shell must load offline. Report the result on issue #1 and close it if green.

---

## Self-Review Notes

- Spec coverage: this plan covers only epic #1 (scaffolding & deployment) — Architecture bullets "Stack", "Hosting", "Offline" from the spec. Storage/i18n/handoff are later epics by design.
- The epic's "done when" maps to: installs (Task 5 + 8.6), loads offline (Task 5 + 8.6), auto-deploys from main (Task 8).
- Type consistency: `HomeScreen` exported via `modules/home/index.ts` in Task 1, consumed in Tasks 1/4 (Task 6 asserts only the heading text). Base path flows exclusively through Vite `base` → `import.meta.env.BASE_URL` → router `basepath`; no custom wrapper (rejected as over-engineering — the platform config is the single source of truth).
- Modulith conformance: epic 1 ships `app/` + one module (`home`); the spec's Code structure section defines where every later epic lands.
- Icon file names from the assets generator are verified against `ls public/` in Task 5 Step 3 before being referenced (Step 5 note handles drift).
