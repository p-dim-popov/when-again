# when-again — Design

**Date:** 2026-08-07
**Status:** Approved

## Problem

Small service providers (the founding example: a hairdresser) book the next
appointment in a paper notebook. The client walks out, forgets the time, and
has to call and ask. Existing salon platforms solve this with servers,
subscriptions, or commissions — a cost barrier for a one-person business.

## Goal

A free, open-source, installable web app (PWA) with **no backend** that:

- replaces the provider's paper notebook (schedule + client visit history), and
- hands each appointment to the client's phone at the moment of booking, with
  a reliable reminder via the phone's own calendar.

"No backend" is a hard constraint: static hosting serves the app's code; no
user data ever reaches any server. Free for everyone, forever, by construction.

## Non-goals (v1)

- No accounts, login, or cloud sync.
- No push notifications (impossible without a server; the OS calendar handles
  reminders instead).
- No online booking by clients — the provider owns the schedule.
- No payments, marketing, or discovery features.

## Architecture

One static PWA, one codebase, two modes chosen on first launch (switchable in
settings): **Provider** and **Client**.

- **Stack:** Svelte + Vite. Small bundle, no framework runtime bloat.
- **Hosting:** Cloudflare Pages free tier (static files only).
- **Offline:** service worker caches the app shell; the app works fully
  offline after first load.
- **Storage:** IndexedDB on the device (thin wrapper, e.g. `idb`). The app
  requests persistent-storage permission to resist browser eviction.
- **i18n:** Bulgarian and English at launch; language auto-detected,
  manually switchable.
- **Privacy:** no analytics, no network calls after the app loads. The URL
  fragment mechanism (below) keeps appointment data off the wire.

## Data model (provider)

| Store | Fields |
|---|---|
| Client | id, name, phone (optional), notes |
| Appointment | id, clientId, start (local wall-clock + timezone name), duration, service label, price (optional), status: booked / done / cancelled |
| Settings | provider name, address (optional), service presets with durations, language |

Visit history = past appointments grouped per client; no separate bookkeeping.

**Backup:** one-tap JSON export (a single file the provider saves anywhere);
import restores it. The app nags gently (about monthly) if no recent backup.

## Handoff (core mechanism)

Booking a slot builds a compact payload — provider name, address, service,
start, duration, stable appointment id, payload version — encoded base64url
into the URL **fragment**: `https://<app>/#a=...`. Fragments are never sent to
any host, so the data travels only between the two phones.

From that URL the provider's share screen offers:

1. **QR code** rendered on screen — client scans with the normal camera app.
2. **Share link** via the system share sheet (Viber, SMS, anything).

Opening the URL loads the app (from cache or network), which decodes the
payload, stores the appointment in the client's IndexedDB, and offers:

- **Add to calendar** — generates an .ics with a built-in reminder.
- **Save salon** — keeps provider name/phone for future visits.

**Updates and cancellations:** same appointment id ⇒ re-shared links overwrite
in place on the client's phone (never duplicate). A `cancelled` flag in the
payload marks the client's stored copy cancelled. Re-sharing is one tap from
the edited appointment. The provider cannot *push* changes — re-sharing is the
explicit, honest substitute.

**Calendar dedupe:** the .ics uses a stable `UID` (derived from the
appointment id) and an incrementing `SEQUENCE`; compliant calendar apps
(Apple, Google) update the existing event in place. Cancellation exports
`STATUS:CANCELLED`. Because some Android calendar apps mishandle UID matching
on manual imports, the "appointment changed" screen explicitly says the time
changed and shows the new one — the app is always authoritative.

## Provider mode UI

Bottom tabs, four screens:

- **Today / Week** — agenda-style day list (default view), week strip on top,
  arrows/swipe between days. Tapping an empty area starts a booking there.
- **New/edit appointment** — client (search-as-you-type or inline new),
  service (presets, free text allowed), date/time, duration (pre-filled from
  service), optional price. Saving lands on the **share screen** (big QR,
  share-link button). Cancel/reschedule live on the same edit screen and also
  end at the share screen, so re-sharing is the natural last step.
- **Clients** — alphabetical list → client page: phone (tap to call), notes,
  visit history (service + price, newest first).
- **Settings** — salon name/address, service presets, language, export/import
  backup, mode switch.

## Client mode UI

Two screens, deliberately minimal:

- **Home** — next appointment as a big card (date, time, service, salon,
  countdown), with Add to calendar and the salon's phone if saved. Past
  visits listed below. Multiple salons coexist, grouped by provider name.
- **Import screen** (opening a shared link) — what, when, from whom, one
  confirm button; distinct variants for changed and cancelled appointments.

## Edge cases

- **Offline scan:** service worker serves the app from cache; the payload is
  in the URL itself, so import works with zero connectivity. Only a
  first-ever open needs internet once; the share screen says so.
- **Malformed/truncated payload:** friendly "link is damaged — ask for it
  again" screen; never a crash.
- **Time semantics:** local wall-clock time + timezone name. 15:00 means
  15:00 at the salon.
- **Duplicate client names:** allowed; disambiguated by phone/notes; never
  merged silently.
- **Storage eviction:** persistent-storage request + backup nag.
- **Version skew:** payload carries a version; unknown fields ignored;
  incompatible versions show "update the app (reload)".

## Testing

- **Unit (Vitest):** payload encode/decode round-trips, .ics generation
  (UID/SEQUENCE/cancel), date handling, import/merge rules.
- **E2E (Playwright):** the two golden paths — provider books → link
  produced; client opens link → appointment stored → calendar file offered.
  Runs in CI (GitHub Actions).
- **Manual device pass:** camera QR scan, add-to-calendar on real Android and
  iOS, offline install behavior.

## Open source & AI transparency

- MIT license. Public repo: `p-dim-popov/when-again`.
- Developed in the open with substantial AI assistance (Claude Code). The
  README states this plainly; AI-assisted commits carry the standard
  "Generated with Claude Code" attribution.
- This design document is itself the product of an AI-assisted brainstorming
  session and is committed to the repo as the project's founding spec.

## Delivery

Work is tracked as epics (GitHub issues on a project board), derived from
this spec. Implementation follows per-epic; each epic becomes its own
plan → implement → review cycle.
