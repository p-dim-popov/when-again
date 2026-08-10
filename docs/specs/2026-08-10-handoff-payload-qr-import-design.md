# Epic 6 — Handoff: payload, QR, share link, import (design)

**Goal:** Make a booked appointment travel from the provider's phone to the
client's phone — as a QR code or a share link — and import cleanly on the
client side, with reschedules and cancellations flowing through the same
channel and never creating duplicates. No server; the appointment data lives
only in the URL fragment.

**Status:** Design approved 2026-08-10. Supersedes the placeholder share
button in `booking/ShareLanding`.

**Done when:** book → scan (or open link) → appointment appears on the
client's phone works end to end, including reschedule and cancel via
re-share, with no duplicates.

---

## 1. Scope

**In (this epic):**

- A versioned, compact payload encoding one appointment.
- The provider **share screen**: QR render + system share-sheet link + copy.
- The client **import screen**: decode → classify → write to a local store,
  with distinct new / changed / cancelled states.
- A new client-side store for received appointments.

**Out (deferred, with the boundary stated so we build the seam, not the
feature):**

- **Client home / "salons" list (#7).** This epic writes received
  appointments to a store and shows a per-import confirmation; it does **not**
  build a browsable list. After an import the "Done" button returns to `/`.
  The `received` store defined here is exactly what #7's home builds on.
- **Calendar reminders / `.ics` (#8).** The payload carries `duration` and a
  timezone label so #8 can emit a `TZID` event with a stable `UID`/`SEQUENCE`,
  but no `.ics` is generated here.
- **Mode switching (#7).** The `/import` route works regardless of the
  device's provider/client mode; importing does not flip modes.

## 2. Architecture

Two new modules; the dependency graph stays acyclic.

- **`received`** — low entity module (peer of `appointments`). Owns the
  `ReceivedAppointment` type and its store CRUD. Depends only on `db` and
  `time`. Owns no UI.
- **`handoff`** — high module. Owns the payload **codec** (pure), the provider
  **share widget**, and the client **import screen**. Depends on `received`,
  `settings`, `i18n`, `time`, and the QR library. **Must not import
  `booking`** (keeps the graph acyclic — `booking` depends on `handoff`, not
  the reverse).

Wiring:

- `booking/ShareLanding` renders `handoff`'s `<HandoffShare appointment=…
  provider=… />`. So `booking → handoff`.
- A new `/import` route (`src/app/routes/import.tsx`) renders `handoff`'s
  `<ImportScreen />`. The route file imports only `handoff`'s public API.
- `schedule` and `appointments` are untouched.

```
db, time, i18n                (leaves)
   ↑        ↑
received   settings
   ↑    ↖    ↑
       handoff  ←────  booking
```

## 3. Data model — `received`

```ts
// received/received.ts — owns its own type (db holds store names only)
export interface ReceivedAppointment {
  id: string;               // the provider's appointment id — the dedupe key
  providerName: string;
  address?: string;
  service: string;
  start: WallClock;         // { dateTime: 'YYYY-MM-DDTHH:mm', timeZone: IANA }
  durationMinutes: number;
  status: 'booked' | 'cancelled';
}
```

Public API (`received/index.ts`):

- `getReceived(id): Promise<ReceivedAppointment | undefined>`
- `upsertReceived(appt: ReceivedAppointment): Promise<void>` — `put` by id.
- `markReceivedCancelled(id): Promise<void>` — flips a stored copy to
  `cancelled`; no-op if absent.
- `listReceived(): Promise<ReceivedAppointment[]>` — `getAll`, for #7.

**DB migration.** Bump `DB_VERSION` 1 → 2. In `upgrade`, guard with
`if (oldVersion < 2)` and `createObjectStore(STORE_RECEIVED, { keyPath: 'id'
})`. `STORE_RECEIVED = 'received'` is added to the `db` module's exported
store-name constants. No index in this epic (get-by-id + getAll suffice); #7
adds a `byDateTime` index if its list needs one (a later version bump).

## 4. Payload & link

**Shape** — compact single-letter keys to keep the QR small:

```
{ v:1,               // schema version
  i:<uuid>,          // appointment id (dedupe/overwrite key)
  p:"Салон Арома",   // provider name  (from settings.providerName)
  a?:"ул. …",        // address        (from settings.address, omitted if empty)
  s:"Подстригване",  // service
  t:"2026-08-15T15:00",   // start dateTime — wall-clock, literal
  z:"Europe/Sofia",  // timezone label (from start.timeZone)
  d:45,              // durationMinutes
  c:0 }              // status: 0 = booked, 1 = cancelled
```

**Encoding** — `JSON.stringify` → `TextEncoder` (UTF-8, so Cyrillic provider /
service / address survive) → **base64url** (standard base64 with `+→-`,
`/→_`, `=` stripped). Decode reverses it. Zero dependencies; builtins only.

*Why base64url over JSURL / friends:* base64url is uniform over bytes, so
Cyrillic costs ~2.67 chars/char. Text-preserving encoders (JSURL) keep ASCII
in place but escape every non-ASCII byte (~6 chars/char), which is a net loss
for this Bulgarian-first payload, and they add a dependency for a lossless
transform builtins already do. A ~200-char byte-mode QR is version ~9–10 at
ECC M — scans fine off a phone screen — so we are not size-pressured. If a
real QR ever proves too dense, the lever is the 36-char UUID (raw 16 bytes →
22-char base64url), not the encoding; the versioned envelope lets us switch
later without breaking the codec. Not done now (YAGNI).

**Link:**

```
`${window.location.origin}${import.meta.env.BASE_URL}import#<base64url>`
→ https://p-dim-popov.github.io/when-again/import#eyJ2Ijox…
```

The path `/import` is served by GitHub Pages' SPA 404 fallback → the app
boots → the router matches `/import` → the screen reads `location.hash`. The
**path** reaches the host (it carries no data); the **fragment** never does.
Base path comes from `BASE_URL` — never hardcoded — so a future custom domain
is a config change. base64url's charset is fragment-safe (no
percent-encoding).

**Codec API** (`handoff`, pure, unit-tested):

- `encodeHandoff(input): string` — returns the base64url fragment.
- `buildHandoffUrl(input): string` — the full absolute link.
- `decodeHandoff(fragment): DecodeResult` — validates `v`, then every field
  (types, `c ∈ {0,1}`, `t` shape); returns `{ ok: true, appointment }` or
  `{ ok: false, reason: 'malformed' | 'unsupported-version' }`. Mirrors
  `backup/parseBackup`'s validate-then-trust discipline.

## 5. Provider share screen

`ShareLanding` keeps its existing summary card. Its disabled "Сподели" button
is replaced by a QR + share row rendered by `<HandoffShare>`:

```
┌────────────────────────────┐
│      Appointment saved      │
│  ┌──────────────────────┐   │
│  │ client · service      │   │  ← existing summary dl (unchanged)
│  │ when · duration       │   │
│  └──────────────────────┘   │
│       ▛▀▚▖▞▀▛  (QR, SVG)     │  ← encodes buildHandoffUrl(...)
│    [ Share link ] [ Copy ]   │  ← navigator.share / clipboard
│          [ Done ]            │
└────────────────────────────┘
```

- **QR:** `qrcode.react` (MIT), rendered as inline **SVG** — crisp at any DPR,
  themeable to the app tokens (`bg`/`ink`), fully offline, no CDN. ECC level
  **M**.
- **Share link:** `navigator.share({ url })` where available; otherwise the
  button falls back to writing the URL to the clipboard. **Copy** always
  writes the URL to the clipboard (`navigator.clipboard.writeText`).
- Inputs come from the appointment (already on `ShareLanding` via the draft /
  `['appointment', id]` record) plus `settings.providerName` / `address`.
- If `providerName` is empty (never set in Settings), the QR/link still
  encode — provider name is a display field, not required for correctness —
  but the screen shows a gentle hint to set a name in Settings so the client
  sees who it is from.

## 6. Import flow (client side)

`/import` → `<ImportScreen>` reads `location.hash.slice(1)` →
`decodeHandoff`:

- `ok: false` → a calm **invalid** state: *"This link isn't valid"* (malformed)
  or *"This link is from a newer version — update the app"*
  (unsupported-version), with a button back to `/`.
- empty hash → **nothing to import** empty state.
- `ok: true` → look `appointment.id` up in `received` and **classify** (pure
  `classifyImport(incoming, stored)`):

| Condition | State | Primary action |
|---|---|---|
| `c:1` (cancelled) | **Cancelled** | `markReceivedCancelled(id)` (records a cancelled stub if never seen) |
| id not stored, `c:0` | **New** | `upsertReceived` |
| id stored, `c:0`, fields differ | **Changed** | `upsertReceived` (overwrite in place) |
| id stored, `c:0`, identical | **Up to date** | none — already added |

- **New:** *"New appointment from {provider}"* + full card (service, when,
  duration, address). Primary: **Add appointment**.
- **Changed:** *"Updated appointment"* — shows the diff for the fields that
  moved (when / service / duration) as old → new. Primary: **Update**.
- **Cancelled:** *"Appointment cancelled"* + the summary. Primary: **OK**
  (marks the stored copy cancelled).
- **Up to date:** *"Already added"* — no write. Secondary: **Done**.

Each action writes to `received` (upsert / cancel — both keyed by id, so
re-scanning is idempotent and never duplicates), then shows a brief
confirmation (*Added* / *Updated* / *Cancelled*) with **Done** → `/`. Field
comparison for "differ vs identical" is a pure equality over the stored fields
(everything except `id`).

## 7. Time / wall-clock semantics

The client sees the **literal** wall-clock time — `15:00` means 15:00 at the
salon — with the timezone label shown for disambiguation. No conversion to
the client's local zone (a client in another zone still travels to the salon,
so the salon's clock is the correct one to display). This resolves the parked
`wallClockNow` "label vs convert" decision in favour of **label**: the stored
`timeZone` is a display/`.ics`-`TZID` label, not a conversion instruction.

## 8. Error handling

- Malformed base64 / JSON, wrong `v`, missing or wrong-typed field → the
  invalid state (§6); never a thrown/blank screen.
- `navigator.share` absent or rejected (user cancels) → no error surfaced;
  Copy remains available.
- `clipboard.writeText` failure → a brief "couldn't copy" note (rare).
- Import write failure (IndexedDB quota / txn) → an inline error on the import
  screen; the appointment is not marked added.

## 9. i18n

New string keys under a `handoff.*` namespace, registered by the `handoff`
module (EN + BG). BG copy is draft, per the project-wide native-speaker pass
deferred to the end of the project. User-facing strings follow STE at
implementation. Keys cover: share (title already exists on the landing; add
`shareLink`, `copy`, `copied`, `setNameHint`), and import (`new.title`,
`changed.title`, `cancelled.title`, `upToDate.title`, `invalid.malformed`,
`invalid.version`, `empty`, field labels reused from `booking.landing.*`
where possible, and the `add`/`update`/`ok`/`done` actions + `added`/
`updated`/`cancelled` confirmations).

## 10. Dependencies

- **`qrcode.react`** (MIT) — new runtime dependency, the only one this epic
  adds. Chosen for an inline-SVG React component that is offline and
  token-themeable. No CDN, consistent with the self-hosted-assets rule.

## 11. Testing

**Unit (Vitest):**

- Codec round-trip: `decodeHandoff(encodeHandoff(x)) ≈ x`, including a
  Cyrillic provider/service/address.
- Rejections: malformed base64, non-JSON, unknown `v`, missing/typo'd field,
  `c` out of range.
- `buildHandoffUrl` respects `BASE_URL` (no hardcoded `/when-again/`).
- `received` CRUD on `fake-indexeddb`: upsert overwrites by id;
  `markReceivedCancelled` flips status and no-ops when absent; migration
  creates `STORE_RECEIVED` and leaves v1 stores intact.
- `classifyImport`: the four rows of the table, plus the identical-fields
  "up to date" path.

**e2e (Playwright), one flow:** book (provider) → on the share screen read the
link (exposed via the Copy button's target / a `data-testid` on the link) →
`page.goto` it → **New** → Add → assert stored/confirmed → reschedule the
appointment → re-open the new share link → **Changed** (diff shown) → Update →
cancel the appointment → re-open the link → **Cancelled** → assert exactly one
`received` record throughout (no duplicates).

## 12. Deferred / follow-ups (not blocking)

- UUID compaction (raw 16 bytes → 22-char base64url) behind `v:2` — only if a
  real QR proves too dense.
- `received` `byDateTime` index — added by #7 when its list needs ordering.
- A visible "current version" / manual "check for updates" affordance is
  unrelated (tracked under #24's out-of-scope note).
