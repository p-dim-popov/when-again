import { createFileRoute } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { ScheduleScreen, todayKey } from '../../modules/schedule';
import { ClientVisitsList } from '../../modules/shell';
import { getSettings } from '../../modules/settings';

interface TodaySearch {
  date?: string;
  // Carried through the reschedule detour: when the day view was reached via
  // the form's "Промени" in edit mode, `appt` is the id being edited so the
  // next slot tap forwards it back to the form (keeping the round trip an
  // edit rather than a new booking).
  appt?: string;
  // Carried through a NEW-booking "Промени" round trip (#16): tells the form
  // this day view visit is a continuation of an in-progress booking, not a
  // fresh entry, so the draft (client/service/price) must survive. Absent on
  // every other route into the day view (browse, month-header jump), so an
  // abandoned booking's fields never leak into an unrelated fresh one.
  resume?: boolean;
}

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): TodaySearch => ({
    date: typeof search.date === 'string' ? search.date : undefined,
    appt: typeof search.appt === 'string' ? search.appt : undefined,
    resume:
      search.resume === true || search.resume === 'true' ? true : undefined,
  }),
  component: Home,
});

function Home() {
  const settings = useLiveQuery(() => getSettings(), []);
  if (settings === undefined) return null;
  return settings.mode === 'client' ? <ClientVisitsList /> : <TodayRoute />;
}

function TodayRoute() {
  const { date, appt, resume } = Route.useSearch();
  return (
    <ScheduleScreen
      dateKey={date ?? todayKey(new Date())}
      appt={appt}
      resume={resume}
    />
  );
}
