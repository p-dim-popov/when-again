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
