import { type ReceivedAppointment } from '../received';

export type ImportOutcome =
  | { kind: 'new'; incoming: ReceivedAppointment }
  | {
      kind: 'changed';
      incoming: ReceivedAppointment;
      stored: ReceivedAppointment;
    }
  | { kind: 'cancelled'; incoming: ReceivedAppointment }
  | {
      kind: 'upToDate';
      incoming: ReceivedAppointment;
      /**
       * True when the fields match but the incoming revision is ahead of the
       * stored one (a reshared no-op edit). The screen writes the row through
       * silently so a later calendar emit uses the current SEQUENCE.
       */
      revisionBehind: boolean;
    }
  | {
      kind: 'stale';
      incoming: ReceivedAppointment;
      stored: ReceivedAppointment;
    };

// Absent revision (legacy payloads and pre-field stored rows) counts as 0.
function revisionOf(appt: ReceivedAppointment): number {
  return appt.revision ?? 0;
}

// Compare every field except the id (the lookup key). A status flip counts
// as a change, so a re-book after a cancel surfaces as "changed".
function sameFields(a: ReceivedAppointment, b: ReceivedAppointment): boolean {
  return (
    a.providerName === b.providerName &&
    a.address === b.address &&
    a.service === b.service &&
    a.start.dateTime === b.start.dateTime &&
    a.start.timeZone === b.start.timeZone &&
    a.durationMinutes === b.durationMinutes &&
    a.status === b.status &&
    // providerId included deliberately: a stored row imported before the
    // minted id (#7) differs from the enriched incoming one exactly once —
    // the resulting "changed" → update writes the id (self-heal, ADR-0002).
    a.providerId === b.providerId
  );
}

// Revision gates first (KTD7): a link older than the stored row is refused
// as 'stale' before any field comparison — even a stale cancellation, since
// the stored row already reflects a later word from the provider. Then a
// cancellation is always a cancellation (even for an appointment never seen
// — the client still learns it is off). Otherwise: unseen → new; seen and
// identical → upToDate; seen and different → changed.
export function classifyImport(
  incoming: ReceivedAppointment,
  stored: ReceivedAppointment | undefined,
): ImportOutcome {
  if (stored && revisionOf(incoming) < revisionOf(stored)) {
    return { kind: 'stale', incoming, stored };
  }
  if (incoming.status === 'cancelled') return { kind: 'cancelled', incoming };
  if (!stored) return { kind: 'new', incoming };
  return sameFields(incoming, stored)
    ? {
        kind: 'upToDate',
        incoming,
        revisionBehind: revisionOf(incoming) > revisionOf(stored),
      }
    : { kind: 'changed', incoming, stored };
}
