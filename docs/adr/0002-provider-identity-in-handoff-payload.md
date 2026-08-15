# Provider identity travels in the handoff payload as a minted id

The client groups received appointments and saved-provider records by a
stable identity, but the handoff payload originally carried only a free-text
provider name — which splits a client's history in two the moment the
provider renames ("Studio M" → "Studio M ✂️"). We decided the provider mints
a random id once (stored in settings) and every handoff payload carries it as
an optional `v:1` field; the client keys saved providers by that id and falls
back to normalized provider name for payloads that predate the field.

## Considered Options

- **Group by normalized name** — zero payload change, but renames are near
  certain over a multi-year client relationship and each one silently splits
  history.
- **Name + address composite** — splits on either attribute changing; worse.
- **Minted id in the payload** (chosen) — rename-proof at the cost of a few
  QR characters; safe to add inside schema version 1 because decode ignores
  unknown wire keys, so old clients skip it and new clients accept old
  payloads.

## Consequences

The id is identity, everything else is attribute: display name, address, and
phone always come from the latest import, so a rename heals a client's
grouping retroactively. The id is meaningless outside the app (random, no
server registry) — two devices for one provider mint two identities, which
is accepted: the schedule lives on one phone by design.
