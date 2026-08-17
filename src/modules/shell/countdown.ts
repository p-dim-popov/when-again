export type CountdownBucket =
  | { kind: 'minutes'; minutes: number }
  | { kind: 'today'; time: string }
  | { kind: 'tomorrow'; time: string }
  | { kind: 'days'; days: number };

// Days are compared via Date.UTC on the date parts: immune to DST shifts.
function calendarDayDiff(fromDateKey: string, toDateKey: string): number {
  const [fy, fm, fd] = fromDateKey.split('-').map(Number);
  const [ty, tm, td] = toDateKey.split('-').map(Number);
  return Math.round(
    (Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000,
  );
}

// Humane coarse countdown for the next-visit card (#7). Both arguments are
// wall-clock 'YYYY-MM-DDTHH:mm' strings compared naively on the device
// clock — label semantics, no timezone conversion. `new Date()` parses the
// offset-less ISO form as local time per spec, which is exactly the naive
// comparison wanted here.
export function countdownBucket(
  nowDateTime: string,
  startDateTime: string,
): CountdownBucket {
  const minutes = Math.round(
    (new Date(startDateTime).getTime() - new Date(nowDateTime).getTime()) /
      60_000,
  );
  if (minutes < 60) return { kind: 'minutes', minutes: Math.max(minutes, 1) };
  const time = startDateTime.slice(11, 16);
  const days = calendarDayDiff(
    nowDateTime.slice(0, 10),
    startDateTime.slice(0, 10),
  );
  if (days === 0) return { kind: 'today', time };
  if (days === 1) return { kind: 'tomorrow', time };
  return { kind: 'days', days };
}
