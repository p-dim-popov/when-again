# when-again — Design

**Date:** 2026-08-07
**Status:** Approved

## Problem

Small service providers often book the next appointment in a paper notebook.
The founding example is a hairdresser. The client leaves, forgets the time,
and must call to ask. Existing salon platforms solve this with servers,
subscriptions, or commissions. That cost is a barrier for a one-person
business.

## Goal

Build a free, open-source, installable web app (PWA) with no backend. The
app has two jobs:

- It replaces the provider's paper notebook with a schedule and a client
  visit history.
- It moves each appointment to the client's phone at the moment of booking.
  The client's phone calendar then gives a reliable reminder.

"No backend" is a hard constraint. Static hosting serves the app code. No
user data reaches any server. Because there is no infrastructure, the app
is free for everyone.

## Non-goals (v1)

- No accounts, login, or cloud sync.
- No push notifications. They need a server. The phone calendar gives the
  reminders instead.
- No online booking by clients. The provider owns the schedule.
- No payments, marketing, or discovery features.

## Architecture

The app is one static PWA with one codebase and two modes: **Provider** and
**Client**. The user selects the mode at first launch and can change it in
the settings.

- **Stack:** React + Vite + TanStack Router, in TypeScript.
- **Hosting:** GitHub Pages, static files only. The app lives under
  `/when-again/`, and the Vite base path matches. GitHub Actions deploys
  from `main` with no external accounts or secrets.
- **Offline:** A service worker caches the app shell. The app works fully
  offline after the first load.
- **Storage:** IndexedDB on the device, behind a thin wrapper (for example
  `idb`). The app requests persistent-storage permission to resist browser
  eviction.
- **i18n:** Bulgarian and English at launch. The app detects the language
  from the device. The user can change it manually.
- **Privacy:** No analytics. No network calls after the app loads. The URL
  fragment mechanism (see Handoff) keeps appointment data off the wire.

## Code structure

The codebase is a modulith. Every piece of code belongs to exactly one
module under `src/modules/`. There is no shared or utils folder.

- `src/app/` only assembles the application: entry point, router assembly,
  service-worker registration, global styles. No module imports `app`.
- Each module exposes a public API through its `index.ts`. Cross-module
  imports go through that file only, never into module internals.
- Modules can import other modules, but the dependency graph must stay
  acyclic. Entity modules (`appointments`, `clients`, `settings`) sit low.
  UI modules (`booking`, `share`, `visits`) sit high. `db`, `i18n`, and
  `time` are leaves.
- A widget lives in the module that needs it first. Promote it to a `ui`
  module only when a second consumer appears.

| Module | Owns |
|---|---|
| `db` | IndexedDB connection, versioning, migration runner |
| `appointments` | Appointment type, object store, queries, status rules |
| `clients` | Client type, object store, queries, visit-history derivation |
| `settings` | Provider profile, service presets, language, mode |
| `i18n` | Language bundles, `t()`, detection, switching |
| `time` | Wall-clock + timezone-name rules, countdown |
| `booking` | Provider UI: schedule and edit screens |
| `share` | Handoff: payload codec, QR, share and import screens |
| `visits` | Client-mode UI: next-visit card, past visits, saved providers |
| `calendar` | .ics generation (UID, SEQUENCE, CANCEL) |
| `backup` | Export, import, staleness reminder |

## Data model (provider)

| Store | Fields |
|---|---|
| Client | id, name, phone (optional), notes |
| Appointment | id, clientId, start (local wall-clock + timezone name), duration, service label, price (optional), status: booked / done / cancelled |
| Settings | provider name, address (optional), service presets with durations, language |

Visit history is the set of past appointments grouped per client. There is
no separate bookkeeping.

**Backup:** One tap exports all data to a single JSON file. The provider
saves the file anywhere. Import restores it. The app shows a gentle
reminder (about monthly) if there is no recent backup.

## Handoff (core mechanism)

When the provider books a slot, the app builds a compact payload. The
payload holds the provider name, address, service, start, duration, a
stable appointment id, and a payload version. The app encodes the payload
as base64url in the URL **fragment**: `https://<app>/#a=...`. Browsers do
not send the fragment to any host, so the data travels only between the
two phones.

The provider's share screen offers two outputs from the same URL:

1. **QR code** on the screen. The client scans it with the normal camera
   app.
2. **Share link** through the system share sheet (Viber, SMS, or any other
   app).

When the client opens the URL, the app loads from cache or network. The
app decodes the payload, stores the appointment in the client's IndexedDB,
and offers two actions:

- **Add to calendar** — the app generates an .ics file with a built-in
  reminder.
- **Save provider** — the app keeps the provider name and phone for future
  visits.

**Updates and cancellations:** The appointment id is stable. A re-shared
link overwrites the stored appointment in place and never creates a
duplicate. A `cancelled` flag in the payload marks the client's stored copy
as cancelled. Re-share is one tap from the edited appointment. The provider
cannot push changes. Re-share is the explicit, honest substitute.

**Calendar dedupe:** The .ics uses a stable `UID` derived from the
appointment id, and an incrementing `SEQUENCE`. Compliant calendar apps
(Apple, Google) then update the existing event in place. A cancellation
exports `STATUS:CANCELLED`. Some Android calendar apps do not match the UID
correctly on manual imports. For that reason, the "appointment changed"
screen states that the time changed and shows the new time. The app is
always authoritative.

## Provider mode UI

Bottom tabs with four screens:

- **Today / Week** — the default view. An agenda-style day list with a week
  strip on top. Arrows or a swipe move between days. A tap on an empty area
  starts a booking at that time.
- **New/edit appointment** — client (search while you type, or create a new
  client inline), service (presets, free text allowed), date and time,
  duration (pre-filled from the service), optional price. Save leads to the
  **share screen** with a large QR code and a share-link button. Cancel and
  reschedule live on the same edit screen. They also end at the share
  screen, so re-share is the natural last step.
- **Clients** — an alphabetical list. The client page shows the phone (tap
  to call), notes, and the visit history (service and price, newest first).
- **Settings** — provider name and address, service presets, language,
  backup export and import, mode switch.

## Client mode UI

Two screens:

- **Home** — the next appointment as a large card (date, time, service,
  provider, countdown). The card offers "Add to calendar" and the
  provider's phone if saved. Past visits appear below. Multiple providers
  coexist, grouped by provider name.
- **Import screen** — opens from a shared link. It shows what, when, and
  from whom, with one confirm button. Changed and cancelled appointments
  get distinct variants.

## Edge cases

- **Offline scan:** The service worker serves the app from cache. The
  payload is in the URL itself, so import works with zero connectivity.
  Only the first-ever open needs internet, once. The share screen says so.
- **Malformed payload:** The app shows a friendly screen: "This link is
  damaged — ask for it again." It never crashes to a blank screen.
- **Time semantics:** The app stores local wall-clock time plus the
  timezone name. 15:00 means 15:00 at the provider's location.
- **Duplicate client names:** Allowed. The provider tells them apart by
  phone or notes. The app never merges them silently.
- **Storage eviction:** The app requests persistent storage. The backup
  reminder is the second line of defense.
- **Version skew:** The payload carries a version. The app ignores unknown
  fields. For an incompatible version, the app shows "update the app
  (reload)".

## Testing

- **Unit (Vitest):** payload encode/decode round-trips, .ics generation
  (UID, SEQUENCE, cancel), date handling, import and merge rules.
- **E2E (Playwright):** the two golden paths. One: the provider books, and
  the app produces a link. Two: the client opens the link, and the app
  stores the appointment and offers the calendar file. CI runs both
  (GitHub Actions).
- **Manual device pass:** camera QR scan, add-to-calendar on real Android
  and iOS devices, offline install behavior.

## Open source and AI transparency

- MIT license. Public repo: `p-dim-popov/when-again`.
- We develop the project in the open with substantial AI help (Claude
  Code). The README states this plainly. AI-assisted commits carry the
  "Generated with Claude Code" attribution.
- This design document is the product of an AI-assisted brainstorming
  session. It is the founding spec of the project.

## Delivery

GitHub issues track the work as epics on a project board. The epics derive
from this spec. Each epic gets its own plan → implement → review cycle.
