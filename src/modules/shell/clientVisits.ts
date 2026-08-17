import type { ReceivedAppointment } from '../received';

// v1 client home (#7 sub-project 1): a plain partitioned list. Sub-project 2
// replaces the presentation with the big-card home & salons; this split
// logic stays.
export function partitionVisits(
  items: ReceivedAppointment[],
  nowDateTime: string,
): { upcoming: ReceivedAppointment[]; past: ReceivedAppointment[] } {
  const upcoming = items
    .filter((v) => v.start.dateTime >= nowDateTime)
    .sort((a, b) => a.start.dateTime.localeCompare(b.start.dateTime));
  const past = items
    .filter((v) => v.start.dateTime < nowDateTime)
    .sort((a, b) => b.start.dateTime.localeCompare(a.start.dateTime));
  return { upcoming, past };
}

// The big card shows the earliest upcoming non-cancelled visit; cancelled
// upcoming rows still appear in the list below it.
export function selectNextVisit(
  upcoming: ReceivedAppointment[],
): ReceivedAppointment | undefined {
  return upcoming.find((v) => v.status !== 'cancelled');
}

// Providers tab chip: each provider's earliest upcoming non-cancelled visit.
export function nextVisitByProvider(
  items: ReceivedAppointment[],
  nowDateTime: string,
): Map<string, ReceivedAppointment> {
  const { upcoming } = partitionVisits(items, nowDateTime);
  const map = new Map<string, ReceivedAppointment>();
  for (const v of upcoming) {
    if (v.status === 'cancelled' || !v.providerId) continue;
    if (!map.has(v.providerId)) map.set(v.providerId, v);
  }
  return map;
}
