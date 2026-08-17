# Client home & saved providers — design

Epic #7, sub-project 2 of 2 (sub-project 1 — mode & settings — shipped in
PR #35). Grilled 2026-08-13/15; term decision in `CONTEXT.md` ("Saved
provider"), identity decision in ADR-0002. Related contracts honored: the
handoff payload/codec (#6), the wall-clock-as-label decision (Epic 3/6),
the `_client` pathless-layout slot reserved by sub-project 1.

## Motivation

A client who imports appointments today gets a deliberately plain list
(`ClientVisitsList` v1). The epic's done-when — "a client who scans a QR
sees their next visit at a glance every time they open the app" — needs the
big-card home. And `received` rows carry only a free-text provider name, so
nothing groups visits by who they're with, nothing survives a provider
rename, and the client has no way to call the salon. This sub-project
delivers the home screen, the saved-provider records behind it, and the
deferred a11y batch.

## Term & identity (settled)

**Saved provider** — the client's saved record of a provider (name,
address, phone). Not a new domain concept: 1:1 with the provider, address
and phone are attributes, identity is a minted id (ADR-0002). Code name
`savedProviders` (module and table) so it cannot be misread as
provider-mode code. Tab/screen labels are UI copy, not domain terms.

## Handoff payload changes (inside `v:1`)

Two new **optional** wire fields; decode ignores unknown keys (verified),
so old clients skip them and new clients accept old payloads — no version
bump:

- `k` — the provider's minted id (`crypto.randomUUID()`).
- `f` — the provider's phone, free-text as entered.

Provider side: settings gain `providerId`, minted lazily the first time a
handoff payload is built and never regenerated; and `phone` (optional,
free-text), edited in the existing Settings → Profile section next to name
and address. `HandoffShare` receives both as props like providerName /
address (module `handoff` still does not import `settings`).

## Client data

- **New table `savedProviders`** `{ id, name, address?, phone? }`, keyed by
  the provider id. Contributed by the new `savedProviders` module via the
  visitor pattern (`defineSavedProvidersStore(db)` + `declare module
  '../db'`), registered in `src/app/main.tsx` and `src/test/setup-db.ts`.
  Next shared Dexie version number; `received` keeps its v1 line.
- **`received` rows gain optional `providerId`**, written on import. No new
  index — a client's dataset is dozens of rows; grouping and partitioning
  stay in JS.
- **Import upserts both** (one write path, idempotent re-scan preserved):
  on successful decode, upsert the saved provider from the payload, then
  `upsertReceived` with that `providerId`. Payloads without `k` use a
  synthetic key derived from the normalized provider name (`name:<...>`),
  so grouping works uniformly. No merge/adoption logic when an id-bearing
  import later matches a synthetic record — pre-field payloads exist only
  in ephemeral QRs, accepted as a duplicate-group edge case.
- **Attributes heal on import** (ADR-0002): name/address/phone on the
  record are overwritten by each import; all display of provider identity
  reads the saved record, so a rename fixes history retroactively.
- **Deleting a saved provider** removes the record **and** its `received`
  rows with that `providerId`, in one `db.transaction` (the `backup`
  pattern: import the `db` object, not `dexie`), behind an explicit
  confirm naming what will be removed.

## Client home (replaces `ClientVisitsList` presentation)

Layout top to bottom, one flat chronological stream (no grouping on home):

1. **Next-visit card** — the earliest upcoming non-cancelled received
   appointment, large: date + time (existing wall-clock formatting),
   service, provider name, countdown, and the provider's phone as a
   `tel:` link when known. **No add-to-calendar — that is #8**, which adds
   one button to this card.
2. **Remaining upcoming visits** — soonest first.
3. **Past visits** — newest first, cancelled entries dimmed/struck as
   today.

Empty card state (no upcoming visit): a calm "no upcoming visit" card with
a hint that scanning the QR at the salon adds the next one.

**Countdown**: humane coarse text, no seconds — under an hour → "in N
min"; later today → "today at HH:mm"; tomorrow → "tomorrow at HH:mm";
else → "in N days". Pure function of (now, start); recomputed on a
one-minute interval plus `visibilitychange`, fixing the stale render-time
clock noted in sub-project 1. Comparison is naive device wall-clock per
the label decision — no timezone conversion.

The upcoming/past partition (`partitionVisits`) is kept and driven by the
same ticking now, so the card and lists roll over together.

## Saved-providers tab

Client tabs become three (`grid-cols-3`): Home / saved providers /
Settings. New client-only route under the new pathless layout
`src/app/routes/_client.tsx` (`<ModeGate mode="client">`, the twin
reserved by sub-project 1); route path `/providers` (URL is a technical
identifier, neutral wording).

Flat list of cards — name, address, `tel:` phone link, next-visit chip
(date of the soonest upcoming visit with that provider, if any) — plus the
delete action with confirm. No per-provider detail route this epic. Empty
state: a calm line that salons appear here after a QR scan. Legacy
name-keyed groups appear identically (their synthetic records are real
rows).

## A11y batch (deferred here from sub-project 1)

- `VersionFooter`: `aria-expanded` on the toggle; persistently-mounted
  `role=status` live region (from #33).
- Visits list(s): `role=list` semantics.
- `Segmented` control: radiogroup pattern with `aria-label`.
- Backup confirm panel: move focus into the panel on open.

## Strings

All new user-facing strings via `i18n` per-module `strings.ts` (EN + BG,
BG stays draft pending the native-speaker pass; the known
Отменен/Отказан drift stays parked for that pass). Simplified Technical
English. Affected modules: `shell` (tabs, home, providers screen),
`savedProviders` (if it owns UI strings), `handoff` (none expected —
payload only), `settings`/`booking` profile strings for the phone field.

## Testing

- **Unit (Vitest):** codec round-trip with `k`/`f` + both-direction legacy
  interop (old payload → new decode, new payload fields ignored-safe);
  countdown bucket function (minute/today/tomorrow/days boundaries,
  midnight rollover); partition + next-visit selection (cancelled
  excluded); import upsert writes savedProvider + providerId, synthetic
  key for id-less payloads, attribute healing on re-import; delete
  transaction removes record + its received rows and nothing else;
  `providerId` minted once and stable; strings parity (existing pattern).
- **e2e (Playwright):** full handoff round-trip lands on a client home
  showing the big card with countdown and tel: link; providers tab lists
  the salon with next-visit chip; delete with confirm empties both list
  and home; empty states render on a fresh client profile; mode switch
  still swaps tab bars (now 3 client tabs).

## Out of scope (→ later)

- Add-to-calendar / `.ics` (#8) — the card ships without the button.
- Per-provider detail route (visit history per salon).
- Client-mode backup (format v2 including `received` + `savedProviders`).
- Merge/adoption of synthetic name-keyed records into id-keyed ones.
- Native-speaker BG pass (project-end).
