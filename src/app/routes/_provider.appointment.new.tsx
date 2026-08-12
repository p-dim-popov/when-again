import { createFileRoute } from '@tanstack/react-router';
import { AppointmentForm } from '../../modules/booking';

interface NewAppointmentSearch {
  date?: string;
  time?: string;
  // The appointment id being edited (absent ⇒ new booking). See
  // `AppointmentForm`'s mount logic.
  appt?: string;
  // See the day view's `resume` (#16) — forwarded through to the form so it can
  // decide whether to reset the draft on entry.
  resume?: boolean;
}

// The day view (schedule) navigates here on a quick-slot or "друг час" pick,
// passing the choice as search params so `schedule` never has to import
// `booking`. `AppointmentForm` is draft-backed (see
// `modules/booking/draftStore.ts`); it seeds the draft with these search
// params on mount and its "Промени" control navigates back to `/` so the
// provider can re-pick a time, then returns here.
export const Route = createFileRoute('/_provider/appointment/new')({
  validateSearch: (search: Record<string, unknown>): NewAppointmentSearch => ({
    date: typeof search.date === 'string' ? search.date : undefined,
    time: typeof search.time === 'string' ? search.time : undefined,
    appt: typeof search.appt === 'string' ? search.appt : undefined,
    resume:
      search.resume === true || search.resume === 'true' ? true : undefined,
  }),
  component: NewAppointmentRoute,
});

function NewAppointmentRoute() {
  const { date, time, appt, resume } = Route.useSearch();
  return (
    <AppointmentForm date={date} time={time} appt={appt} resume={resume} />
  );
}
