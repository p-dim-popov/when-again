# Welcoming pass — design

Issue: #41. Decision record: `docs/adr/0001-typeface-stack-and-wordmark.md`.
Glossary terms per `CONTEXT.md` (provider, client, mode, welcome screen).

Make the app more welcoming: a new bilingual typeface stack applied
app-wide, a "When Again" wordmark on all user-facing surfaces, correct
Bulgarian letterforms, and a redesign of the welcome screen in place.

## 1. Font stack

**Dependencies** (all at `5.3.0`):

- Add: `@fontsource-variable/sofia-sans-condensed`, `@fontsource-variable/manrope`
- Remove: `@fontsource/lora`, `@fontsource/ibm-plex-sans`

**Imports** (`src/app/main.tsx`): replace the ten static per-subset CSS
imports with two package imports:

```ts
import '@fontsource-variable/sofia-sans-condensed';
import '@fontsource-variable/manrope';
```

Variable packages carry one `@font-face` per subset with `unicode-range`,
so browsers fetch only the latin + cyrillic woff2 files (~106 KB total,
down from ~184 KB).

**Tokens** (`src/app/index.css`, `@theme inline`):

```css
--font-display: 'Sofia Sans Condensed Variable', system-ui, sans-serif;
--font-sans: 'Manrope Variable', system-ui, sans-serif;
```

`--font-serif` is removed. The `'… Variable'` family names are exact —
Fontsource registers variable fonts under that suffix (ADR-0001).

**Call sites**: rename all ten `font-serif` utility usages to
`font-display` across `AppointmentForm.tsx`, `MonthPicker.tsx`,
`ShareLanding.tsx`, `ImportScreen.tsx`, `ScheduleScreen.tsx`,
`ClientVisitsList.tsx`, `FirstRunChooser.tsx`, `SettingsScreen.tsx`.

**Bounded nudges**: where the condensed face visibly weakens a heading,
per-call-site adjustments to weight, size, or tracking are allowed — no
layout or markup changes. Each nudge is verified with phone-viewport
screenshots (light + dark). Weight axes available: Sofia Sans Condensed
1–1000, Manrope 200–800. No italics are loaded; do not use italic styles.

**Numbers**: no new numeric styling. If visual QA shows digit-alignment
regressions (schedule times), fix with `font-variant-numeric: tabular-nums`
(`tabular-nums` utility) at that call site only. The version stamp may use
the default `font-mono` system stack if the body face degrades it.

## 2. Bulgarian letterforms (`lang` wiring)

Manrope's Bulgarian forms activate only under `lang="bg"` (its `BGR`
`locl`); Sofia Sans is Bulgarian-by-default (ADR-0001). Today
`index.html` hardcodes `lang="en"` and nothing updates it.

- In `bootstrap()` (`src/app/main.tsx`), after the language is resolved:
  `document.documentElement.lang = language;` — one seam, runs every boot.
- Language switching already reloads the page (`applyLanguageChoice`), so
  boot-time assignment covers switches. The i18n module stays DOM-free.
- `index.html` keeps `lang="en"` as the pre-boot default.

This is also an a11y fix: screen readers currently announce Bulgarian UI
with English pronunciation rules.

## 3. Wordmark

"When Again" replaces the `when-again` slug on user-facing surfaces only:

- `index.html`: `<title>When Again</title>`
- `vite.config.ts` manifest: `name: 'When Again'`, `short_name: 'When Again'`
- Strings (`src/modules/shell/strings.ts`): the welcome prompt drops the
  slug — EN `shell.chooser.title`: `How will you use it?`, BG:
  `Как ще го използвате?` (the wordmark right above makes "it"
  unambiguous; avoids repeating the name).

Technical identifiers keep the slug unchanged: backup `app` field, Dexie
database name, backup file names, repository URLs.

## 4. Welcome screen

`FirstRunChooser.tsx` is redesigned in place — same mount condition
(`settings.mode === null`, except on `/import`), no new route, no extra
step. Required elements, top to bottom:

1. **Wordmark** — "When Again" set in the display face; text, not an image.
2. **Tagline** — one line, new string key `shell.welcome.tagline`:
   - EN: `Appointments on your phone — no accounts, no servers.`
   - BG (draft, pending native-speaker pass):
     `Часове на вашия телефон — без акаунти, без сървъри.`
3. **Mode choice** — the two cards with their existing hint strings
   (`shell.chooser.client`/`clientHint`, `provider`/`providerHint`),
   prompted by the reworded `shell.chooser.title`.
4. **Note** — existing `shell.chooser.note` ("You can change this later…").

Constraints:

- `data-testid="chooser-client"` / `"chooser-provider"` are kept (e2e).
- The container keeps the app-frame pattern
  (`fixed inset-x-0 top-0 h-[var(--app-h,100dvh)]`, own scroller) — see
  the Brave shell rules; nothing anchors to the viewport bottom.
- Theme via tokens only (no `dark:` variants); works in light and dark.
- The `frontend-design` skill drives the visual treatment at
  implementation time within this element list.

## 5. Testing

- **Vitest**: none required beyond existing suites passing — the changes
  are declarative (tokens, strings, imports). The existing
  `shell/strings.test.ts` EN/BG parity check must pass with
  `shell.welcome.tagline` added to both languages.
- **Playwright**: extend the settings e2e — switching language to BG ends
  with `html[lang="bg"]`; back to EN ends with `html[lang="en"]`. Existing
  chooser-flow tests must pass unchanged (testids preserved).
- **Visual**: phone-viewport screenshots of the welcome screen and one
  provider screen (schedule) in light + dark, EN + BG, reviewed before the
  branch review.

## 6. Out of scope

- Copy/empty-state warmth pass on other screens.
- Any handwriting accent face (rejected — ADR-0001).
- Type-scale redesign beyond the bounded nudges above.
- Custom-subset font pipeline; stock Fontsource builds only.
