export interface WallClock {
  /** Local wall-clock time, 'YYYY-MM-DDTHH:mm'. 15:00 means 15:00 at the provider's location. */
  dateTime: string;
  /** IANA timezone name, e.g. 'Europe/Sofia'. */
  timeZone: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function wallClockNow(
  now: Date = new Date(),
  timeZone: string = Intl.DateTimeFormat().resolvedOptions().timeZone,
): WallClock {
  const dateTime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return { dateTime, timeZone };
}

export function compareWallClock(a: WallClock, b: WallClock): number {
  return a.dateTime < b.dateTime ? -1 : a.dateTime > b.dateTime ? 1 : 0;
}

export function isBefore(a: WallClock, b: WallClock): boolean {
  return compareWallClock(a, b) < 0;
}
