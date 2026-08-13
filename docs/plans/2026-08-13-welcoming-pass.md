# Welcoming Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Swap the app to the Sofia Sans Condensed + Manrope font stack, add the "When Again" wordmark, wire `documentElement.lang` for Bulgarian letterforms, and redesign the welcome screen in place.

**Architecture:** Declarative changes to the app shell layer — two Fontsource variable packages replace two static ones, one Tailwind token renames (`font-serif` → `font-display`), one line in `bootstrap()` sets the document language, and `FirstRunChooser.tsx` is rebuilt with the same mount condition and testids. Spec: `docs/specs/2026-08-13-welcoming-pass-design.md`. Rationale: `docs/adr/0001-typeface-stack-and-wordmark.md`.

**Tech Stack:** React + Vite + Tailwind v4 tokens, Fontsource variable packages, Vitest, Playwright.

## Global Constraints

- Font family strings are exact: `'Sofia Sans Condensed Variable'`, `'Manrope Variable'` (Fontsource registers the "Variable" suffix).
- `data-testid="chooser-client"` and `data-testid="chooser-provider"` must survive unchanged (e2e helper depends on them).
- No `dark:` variants — theming is token-only (`bg-bg`, `text-ink`, …).
- The `when-again` slug stays in technical identifiers (backup `app` field, Dexie DB name, backup file names). Only user-facing surfaces say "When Again".
- No italic styles anywhere — italic font files are not loaded.
- Bulgarian copy is a draft pending a native-speaker pass — do not "improve" it beyond what this plan specifies.
- Never hardcode `/when-again/` in app code (e2e specs may use it literally).
- User-facing copy follows Simplified Technical English.
- Before every commit: `npx vitest run`, `npm run lint`, `npm run format:check` (CI gates Prettier separately from ESLint).
- Commit messages: no Claude session links.

---

### Task 1: Font stack swap

**Files:**
- Modify: `package.json` (+ lockfile via npm)
- Modify: `src/app/main.tsx:19-28` (font imports)
- Modify: `src/app/index.css:102-103` (font tokens)
- Modify: 10 `font-serif` call sites (list in Step 3)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: the `font-display` Tailwind utility (token `--font-display`); all later tasks may use it.

- [ ] **Step 1: Swap the packages**

```bash
npm uninstall @fontsource/lora @fontsource/ibm-plex-sans
npm install @fontsource-variable/sofia-sans-condensed @fontsource-variable/manrope
```

Both new packages must resolve to version 5.3.x.

- [ ] **Step 2: Replace imports and tokens**

In `src/app/main.tsx`, delete the ten `@fontsource/lora/...` and `@fontsource/ibm-plex-sans/...` import lines and replace with:

```ts
import '@fontsource-variable/sofia-sans-condensed';
import '@fontsource-variable/manrope';
```

(Keep them above the `./index.css` import.) In `src/app/index.css` `@theme inline`, replace

```css
--font-serif: 'Lora', Georgia, serif;
--font-sans: 'IBM Plex Sans', system-ui, sans-serif;
```

with

```css
--font-display: 'Sofia Sans Condensed Variable', system-ui, sans-serif;
--font-sans: 'Manrope Variable', system-ui, sans-serif;
```

- [ ] **Step 3: Rename the call sites**

```bash
grep -rl "font-serif" src --include="*.tsx" | xargs sed -i 's/\bfont-serif\b/font-display/g'
grep -rn "font-serif" src && echo "LEFTOVERS — fix them" || echo OK
```

Expected files (10 occurrences): `booking/ShareLanding.tsx` (2), `booking/MonthPicker.tsx`, `booking/AppointmentForm.tsx`, `schedule/ScheduleScreen.tsx`, `handoff/ImportScreen.tsx` (2), `shell/ClientVisitsList.tsx`, `shell/SettingsScreen.tsx`, `shell/FirstRunChooser.tsx`. Do NOT change weights/sizes here — visual nudges happen in Task 5 only.

- [ ] **Step 4: Verify**

Run: `npx vitest run` → all pass. Run: `npm run build` → succeeds; confirm `dist/assets/` contains `sofia-sans-condensed-*` and `manrope-*` woff2 files and no `lora`/`ibm-plex-sans` files. Run `npm run lint` and `npm run format:check`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: swap font stack to Sofia Sans Condensed + Manrope (#41)"
```

---

### Task 2: Document-language wiring

**Files:**
- Modify: `src/app/main.tsx` (bootstrap)
- Test: `e2e/settings.spec.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `document.documentElement.lang` always matches the active `Language` (`'en' | 'bg'`) after boot.

- [ ] **Step 1: Write the failing e2e test**

Append to `e2e/settings.spec.ts`:

```ts
test('language switch updates the document language', async ({ page }) => {
  await gotoAsProvider(page, '/when-again/settings');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page
    .getByTestId('language-switch')
    .getByRole('button', { name: 'БГ' })
    .click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'bg');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'bg');
  await page
    .getByTestId('language-switch')
    .getByRole('button', { name: 'EN' })
    .click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});
```

(The `БГ`/`EN` segment labels are literal in `SettingsScreen.tsx`, not translated — stable selectors. `applyLanguageChoice` persists then reloads the page; the assertions wait through it.)

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run build && npx playwright test settings -g "document language"`
Expected: FAIL — `lang` stays `"en"` after the switch.

- [ ] **Step 3: Implement**

In `src/app/main.tsx` `bootstrap()`, immediately after `initI18n(language);`:

```ts
document.documentElement.lang = language;
```

(One seam is enough: language switching reloads the page, so boot always runs. The i18n module stays DOM-free.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run build && npx playwright test settings -g "document language"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/main.tsx e2e/settings.spec.ts
git commit -m "feat: sync document lang with active language (#41)"
```

---

### Task 3: Wordmark surfaces

**Files:**
- Modify: `index.html:27`
- Modify: `vite.config.ts:63-64`
- Modify: `src/modules/shell/strings.ts` (EN line 45, BG line 110)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: "When Again" as the user-facing name everywhere; `shell.chooser.title` reworded (Task 4's welcome screen shows it under the wordmark).

- [ ] **Step 1: Apply the renames**

`index.html`: `<title>when-again</title>` → `<title>When Again</title>`.

`vite.config.ts` manifest: `name: 'when-again'` → `name: 'When Again'`, `short_name: 'when-again'` → `short_name: 'When Again'`.

`src/modules/shell/strings.ts`:
- EN: `'shell.chooser.title': 'How will you use when-again?'` → `'shell.chooser.title': 'How will you use it?'`
- BG: `'shell.chooser.title': 'Как ще използвате when-again?'` → `'shell.chooser.title': 'Как ще го използвате?'`

Touch nothing else — backup `app` field, DB name, and file names keep the slug (Global Constraints).

- [ ] **Step 2: Verify**

Run: `npx vitest run` → all pass (string parity unaffected — same keys). Run: `grep -rn "when-again" index.html vite.config.ts src/modules/shell/strings.ts` → only non-user-facing hits remain (none expected in these three files except none).

- [ ] **Step 3: Commit**

```bash
git add index.html vite.config.ts src/modules/shell/strings.ts
git commit -m "feat: adopt the When Again wordmark on user-facing surfaces (#41)"
```

---

### Task 4: Welcome screen redesign

**Files:**
- Modify: `src/modules/shell/strings.ts` (new key in EN, BG, and the `declare module` augmentation)
- Modify: `src/modules/shell/FirstRunChooser.tsx` (full replacement below)

**Interfaces:**
- Consumes: `font-display` utility (Task 1), reworded `shell.chooser.title` (Task 3).
- Produces: the welcome screen; testids `chooser-client`/`chooser-provider` unchanged.

- [ ] **Step 1: Add the tagline string**

In `src/modules/shell/strings.ts` add to the `en` object (next to the other `shell.chooser.*` keys):

```ts
'shell.welcome.tagline': 'Appointments on your phone — no accounts, no servers.',
```

to the `bg` object:

```ts
'shell.welcome.tagline': 'Часове на вашия телефон — без акаунти, без сървъри.',
```

and to the `declare module` augmentation block at the bottom:

```ts
'shell.welcome.tagline': true;
```

- [ ] **Step 2: Run the parity test**

Run: `npx vitest run src/modules/shell/strings.test.ts`
Expected: PASS (key added to both languages; a miss on either side fails the parity test).

- [ ] **Step 3: Rebuild the welcome screen**

Replace the `FirstRunChooser` component body in `src/modules/shell/FirstRunChooser.tsx` with exactly:

```tsx
import { t } from '../i18n';
import { updateSettings, type Mode } from '../settings';

// The welcome screen (#41). Rendered by AppShell instead of the outlet
// while settings.mode is null (except on /import, where inference decides).
// Persisting the choice removes it reactively — no route, no redirect.
export function FirstRunChooser() {
  const choose = (mode: Mode) => {
    void updateSettings({ mode });
  };
  return (
    <main className="fixed inset-x-0 top-0 flex h-[var(--app-h,100dvh)] flex-col items-center justify-center gap-8 overflow-y-auto p-6 text-center">
      <header className="flex flex-col items-center gap-3">
        <h1 className="text-ink font-display text-[44px] leading-none font-[760] tracking-[-0.02em]">
          When Again
        </h1>
        <p className="text-muted max-w-[28ch] text-[15px] leading-snug">
          {t('shell.welcome.tagline')}
        </p>
      </header>
      <div className="flex w-full max-w-sm flex-col gap-3">
        <p className="text-faint text-[11px] font-semibold tracking-[0.08em] uppercase">
          {t('shell.chooser.title')}
        </p>
        <button
          type="button"
          data-testid="chooser-client"
          onClick={() => choose('client')}
          className="border-line bg-surface rounded-card shadow-card cursor-pointer border px-5 py-4 text-left"
        >
          <span className="text-ink block font-[650]">
            {t('shell.chooser.client')}
          </span>
          <span className="text-faint block text-sm">
            {t('shell.chooser.clientHint')}
          </span>
        </button>
        <button
          type="button"
          data-testid="chooser-provider"
          onClick={() => choose('provider')}
          className="border-line bg-surface rounded-card shadow-card cursor-pointer border px-5 py-4 text-left"
        >
          <span className="text-ink block font-[650]">
            {t('shell.chooser.provider')}
          </span>
          <span className="text-faint block text-sm">
            {t('shell.chooser.providerHint')}
          </span>
        </button>
      </div>
      <p className="text-faint text-sm">{t('shell.chooser.note')}</p>
    </main>
  );
}
```

Design intent (for the reviewer, not to be "improved"): the wordmark in the condensed display face at 44px/weight 760 is the hero; the tagline in muted body face carries the value prop; the old headline question becomes an uppercase eyebrow over the mode cards; cards gain `shadow-card` to match the card treatment elsewhere. The client card stays first (most first-run users are clients receiving a link). Wordmark is untranslated text, never an image.

- [ ] **Step 4: Verify**

Run: `npx vitest run` → all pass. Run: `npm run build && npx playwright test` → full e2e suite passes (the helper's `chooser-provider` click path is unchanged). Run `npm run lint` and `npm run format:check` (Prettier will have ordered the Tailwind classes — run `npm run format` first if the check fails).

- [ ] **Step 5: Commit**

```bash
git add src/modules/shell/strings.ts src/modules/shell/FirstRunChooser.tsx
git commit -m "feat: redesign the welcome screen around the wordmark (#41)"
```

---

### Task 5: Visual QA and bounded nudges

**Files:**
- Possibly modify: any of the ten `font-display` call sites (weight/size/tracking only)
- No new committed files — screenshots go to the plan workspace, not the repo.

**Interfaces:**
- Consumes: everything above.
- Produces: reviewed screenshots; the controller (not this task's implementer) judges which nudges are needed.

- [ ] **Step 1: Build and serve**

```bash
npm run build
npx vite preview --port 4173 &
PREVIEW_PID=$!
```

(Kill with `kill $PREVIEW_PID` when done — never `pkill -f "vite preview"`.)

- [ ] **Step 2: Capture screenshots**

From the repo root (Playwright resolves from the repo's node_modules), with `SHOTS` set to the plan workspace directory:

```bash
node -e '
const { chromium } = require("playwright");
const base = "http://127.0.0.1:4173/when-again/";
const out = process.env.SHOTS || ".";
(async () => {
  const b = await chromium.launch();
  const scenarios = [
    ["welcome-en-light", { colorScheme: "light", locale: "en-US" }, base, null],
    ["welcome-en-dark", { colorScheme: "dark", locale: "en-US" }, base, null],
    ["welcome-bg-light", { colorScheme: "light", locale: "bg-BG" }, base, null],
    ["welcome-bg-dark", { colorScheme: "dark", locale: "bg-BG" }, base, null],
    ["schedule-en-light", { colorScheme: "light", locale: "en-US" }, base, "provider"],
    ["schedule-en-dark", { colorScheme: "dark", locale: "en-US" }, base, "provider"],
    ["settings-en-light", { colorScheme: "light", locale: "en-US" }, base + "settings", "provider"],
  ];
  for (const [name, opts, url, mode] of scenarios) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, ...opts });
    const p = await ctx.newPage();
    await p.goto(url);
    if (mode === "provider") {
      const chooser = p.getByTestId("chooser-provider");
      if (await chooser.isVisible().catch(() => false)) await chooser.click();
      await p.waitForTimeout(300);
    }
    await p.waitForTimeout(700);
    await p.screenshot({ path: `${out}/${name}.png` });
    await ctx.close();
  }
  await b.close();
})();
'
```

- [ ] **Step 3: Report for review**

Return the screenshot paths in the task report. STOP — do not self-judge nudges. The controller reviews the screenshots (welcome hero presence, heading weight after the condensed swap, Bulgarian letterforms visible in the BG shot: б, д, ж shapes differ from Russian forms in body text) and either approves as-is or returns an explicit nudge list (call site → new weight/size/tracking values).

- [ ] **Step 4: Apply directed nudges (if any), re-shoot, verify**

Apply exactly the returned list — weight/size/tracking utilities (plus `tabular-nums` for digit-alignment regressions, per spec §1) only, no layout or markup changes. Re-run Step 2, re-report. When approved: `npx vitest run`, `npm run lint`, `npm run format:check`.

- [ ] **Step 5: Commit (only if nudges were applied)**

```bash
git add -A
git commit -m "style: tune heading weights for the condensed display face (#41)"
```
