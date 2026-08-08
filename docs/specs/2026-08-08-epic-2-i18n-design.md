# Epic 2 — i18n (Bulgarian + English): design

Status: approved 2026-08-08. Epic issue: #2.

## Purpose

Give the app a localization engine so every user-facing string renders in
Bulgarian or English. The language is detected from the device on first run
and can be changed manually in settings. All user-facing strings go through
the engine from day one, so later UI epics never hardcode copy.

## Scope

In scope: the `i18n` leaf module (engine, `t()`, detection, switching), the
per-module string files that feed it, the composition-root wiring that boots
it, the documented switch contract (persist + reload), migrating the one
existing screen (home) onto the engine as the first real consumer, and a
**temporary** language toggle on the home screen so the switch is usable on a
real device now.

The permanent language **control** belongs to the Settings screen (no Settings
screen exists yet), so the home-screen toggle is explicitly temporary: it
proves the switch end to end and gives an on-device BG/EN flip today, and it is
removed when the Settings UI epic adds the real control. Both call the same
switch contract below, so removal is deleting the temporary widget, not
reworking the mechanism.

Not in scope (deliberately, YAGNI): lazy-loaded bundles, live re-render via a
reactive context, per-key parameter typing, any third-party i18n library, and
languages beyond `bg` and `en`.

Acceptance for the epic (from issue #2) — "every screen renders correctly in
both languages and the switch persists" — is verified incrementally as UI
epics land. This epic delivers the mechanism plus its unit tests; each later
UI epic contributes its own strings through the engine.

## Architecture

`i18n` is a leaf module, matching the founding spec's dependency layering
(`db`, `time`, `i18n` are leaves). It never imports another feature module.

### Public API (`src/modules/i18n/index.ts`)

- `t(key, params?)` — typed key lookup, `{var}` interpolation, plural
  selection. Returns the resolved string.
- `registerStrings(lang, strings)` — push-registration of one module's
  strings for one language.
- `detectLanguage(): Language` — maps `navigator.languages` to `'bg' | 'en'`.
- `initI18n(language: Language)` — sets the boot-time active language once.
- `getActiveLanguage(): Language` — the active language for the session.
- `formatNumber(n)`, `formatCurrency(n)` — `Intl.NumberFormat` wrappers bound
  to the active language.
- `interface TranslationKeys {}` — empty; feature modules augment it to
  register their keys into the type system.

`Language` is the existing `'bg' | 'en'` type from the `settings` module.

### Strings live per module, pushed into i18n

Each feature module ships `strings.ts` exporting `{ en: {...}, bg: {...} }`.
Strings live with the code that uses them ("everything belongs somewhere").

Aggregation is **push-based**: the composition root (`src/app`) imports each
module's strings and calls `registerStrings`. i18n does not import feature
modules — this keeps it a leaf and the dependency graph acyclic. If i18n
imported the modules to pull their strings, it would stop being a leaf; that
inversion is the specific thing push-registration avoids.

### Type safety via module augmentation (no codegen)

i18n exports an empty `TranslationKeys` interface. Each module augments it
with its own keys:

```ts
declare module '@/modules/i18n' {
  interface TranslationKeys {
    'appt.new': true;
    'appt.count': true;
  }
}
```

`t()` is typed as `t(key: keyof TranslationKeys, params?)`, so every key
across the distributed key space is checked at compile time. Parameters are a
loose `Record<string, string | number>` for now; per-key parameter types can
be added later if warranted.

### Plurals

A string value is either a plain string or a plural map keyed by
`Intl.PluralRules` categories:

```ts
'appt.count': { one: 'след {count} ден', other: 'след {count} дни' }
```

`t()` reads `params.count`, asks `Intl.PluralRules(activeLanguage)` for the
category, and selects the matching form before interpolation. Bulgarian and
English both resolve to `one` / `other` for cardinals; the map only needs the
categories a given string actually uses.

### Interpolation

`{var}` placeholders are replaced from `params`. A missing placeholder value
is left as-is (no throw); this is caught in review of the strings, not at
runtime.

### Missing keys

`t()` on an unregistered or missing key returns the key string itself as a
visible fallback and does not throw. A missing translation must never blank
the UI or crash a screen.

## Language detection and boot

The composition root becomes an async bootstrap (`src/app/main.tsx`):

1. `getSettings()` (async).
2. `language = settings.language ?? detectLanguage()`. `settings.language`
   stays `null` while on "auto" — the detected value is never persisted, so a
   device-language change is still honored on the next run.
3. Register every module's strings (static imports, both languages).
4. `initI18n(language)`.
5. Render the router.

`detectLanguage()` walks `navigator.languages` and returns the first entry
whose primary subtag is `bg` or `en`. When neither is present it falls back
to **`en`**.

## Switch contract

The switch is a two-line contract that any screen can call — the Settings UI
epic will wire it to a control:

- Pick a language: `updateSettings({ language })` then `location.reload()`.
- Pick "auto": `updateSettings({ language: null })` then `location.reload()` —
  reloads back into detection.

Reload-on-switch is deliberate: `t()` resolves the active language once at
boot, so there is no reactive context to thread through the app and no
re-render plumbing. The PWA service worker serves the reload from cache
instantly.

A **temporary** toggle on the home screen wires this contract (bg / en / auto)
so the switch is usable on a real device now. It is marked temporary in code
and removed when the Settings UI epic adds the permanent control. The existing
home screen is also migrated onto `t()`, so detection and switching are
demonstrably working end to end within this epic.

## Boundary with the `time` module

One owner per concern:

- `i18n` owns locale-driven value formatting: `formatNumber`,
  `formatCurrency` (service prices).
- `time` keeps owning wall-clock semantics: dates, times, countdowns. Where
  `time` needs the locale (month names, "in N days" plurals), it reads
  `getActiveLanguage()` and calls `Intl.DateTimeFormat` / `t()` itself.

`time` may depend on `i18n` for the active-language value; `i18n` never
depends on `time`. No cycle.

## Testing

Vitest, matching the Epic-3 style (pure functions, no DOM):

- `t()`: key lookup; missing key returns the key and does not throw; `{var}`
  interpolation; plural selection for `bg` and `en`.
- `detectLanguage()`: `bg` match, `en` match, fallback to `en`, and a
  multi-entry `navigator.languages` (stubbed).
- `registerStrings` + `t()`: registration composes across multiple modules;
  later registration does not clobber earlier registration.
- `formatNumber` / `formatCurrency`: `bg` and `en` outputs differ as expected.
- Boot resolution: `settings.language` null resolves to detection; a set value
  is honored.

## Open decisions deferred elsewhere

- React store / how async IndexedDB data meets React: tracked on issue #4, not
  forced by this epic (reload-on-switch makes the active language a boot-time
  module value, no store needed).
