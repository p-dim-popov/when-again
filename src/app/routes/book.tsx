import { createFileRoute } from '@tanstack/react-router';
import { MonthPicker } from '../../modules/booking';

interface BookSearch {
  date?: string;
  // Carried when the month picker was opened from the day view mid-flow
  // (reschedule detour): forwarded back to `/` on day-select so the
  // round trip stays an edit rather than becoming a new booking.
  appt?: string;
  // See the day view's `resume` (#16) — forwarded back to `/` on day-select so
  // a new-booking "Промени" round trip keeps the draft instead of resetting it.
  resume?: boolean;
}

export const Route = createFileRoute('/book')({
  validateSearch: (search: Record<string, unknown>): BookSearch => ({
    date: typeof search.date === 'string' ? search.date : undefined,
    appt: typeof search.appt === 'string' ? search.appt : undefined,
    resume:
      search.resume === true || search.resume === 'true' ? true : undefined,
  }),
  component: BookRoute,
});

function BookRoute() {
  const { date, appt, resume } = Route.useSearch();
  return <MonthPicker date={date} appt={appt} resume={resume} />;
}
