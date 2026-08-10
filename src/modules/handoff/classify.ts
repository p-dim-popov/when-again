import { type ReceivedAppointment } from '../received';

export type ImportOutcome =
  | { kind: 'new'; incoming: ReceivedAppointment }
  | {
      kind: 'changed';
      incoming: ReceivedAppointment;
      stored: ReceivedAppointment;
    }
  | { kind: 'cancelled'; incoming: ReceivedAppointment }
  | { kind: 'upToDate'; incoming: ReceivedAppointment };

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
    a.status === b.status
  );
}

// A cancellation is always a cancellation (even for an appointment never seen
// — the client still learns it is off). Otherwise: unseen → new; seen and
// identical → upToDate; seen and different → changed.
export function classifyImport(
  incoming: ReceivedAppointment,
  stored: ReceivedAppointment | undefined,
): ImportOutcome {
  if (incoming.status === 'cancelled') return { kind: 'cancelled', incoming };
  if (!stored) return { kind: 'new', incoming };
  return sameFields(incoming, stored)
    ? { kind: 'upToDate', incoming }
    : { kind: 'changed', incoming, stored };
}
