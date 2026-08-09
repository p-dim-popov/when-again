import {
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { AppShell, Placeholder, SettingsScreen } from '../modules/shell';
import { ScheduleScreen, todayKey } from '../modules/schedule';
import {
  AppointmentForm,
  MonthPicker,
  useBookingDraft,
} from '../modules/booking';
import { t } from '../modules/i18n';

interface TodaySearch {
  date?: string;
  // Carried through the reschedule detour: when the day view was reached via
  // the form's "Промени" in edit mode, `appt` is the id being edited so the
  // next slot tap forwards it back to the form (keeping the round trip an
  // edit rather than a new booking).
  appt?: string;
}

interface NewAppointmentSearch {
  date?: string;
  time?: string;
  // The appointment id being edited (absent ⇒ new booking). See
  // `AppointmentForm`'s mount logic.
  appt?: string;
}

const rootRoute = createRootRoute({
  component: AppShell,
});

const todayRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: (search: Record<string, unknown>): TodaySearch => ({
    date: typeof search.date === 'string' ? search.date : undefined,
    appt: typeof search.appt === 'string' ? search.appt : undefined,
  }),
  component: TodayRoute,
});

function TodayRoute() {
  const { date, appt } = todayRoute.useSearch();
  return <ScheduleScreen dateKey={date ?? todayKey(new Date())} appt={appt} />;
}

const clientsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/clients',
  component: () => <Placeholder titleKey="shell.placeholder.clients" />,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  // Temporary: Epic 7 ships the real Settings screen; for now this keeps the
  // БГ/EN/Auto language toggle reachable (see modules/shell/SettingsScreen).
  component: SettingsScreen,
});

interface BookSearch {
  date?: string;
  // Carried when the month picker was opened from the day view mid-flow
  // (reschedule detour): forwarded back to `/` on day-select so the
  // round trip stays an edit rather than becoming a new booking.
  appt?: string;
}

const bookRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/book',
  validateSearch: (search: Record<string, unknown>): BookSearch => ({
    date: typeof search.date === 'string' ? search.date : undefined,
    appt: typeof search.appt === 'string' ? search.appt : undefined,
  }),
  component: BookRoute,
});

function BookRoute() {
  const { date, appt } = bookRoute.useSearch();
  return <MonthPicker date={date} appt={appt} />;
}

// The day view (schedule) navigates here on a quick-slot or "друг час" pick,
// passing the choice as search params so `schedule` never has to import
// `booking`. `AppointmentForm` is draft-backed (see
// `modules/booking/draftStore.ts`); it seeds the draft with these search
// params on mount and its "Промени" control navigates back to `/` so the
// provider can re-pick a time, then returns here.
const newAppointmentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/appointment/new',
  validateSearch: (search: Record<string, unknown>): NewAppointmentSearch => ({
    date: typeof search.date === 'string' ? search.date : undefined,
    time: typeof search.time === 'string' ? search.time : undefined,
    appt: typeof search.appt === 'string' ? search.appt : undefined,
  }),
  component: NewAppointmentRoute,
});

function NewAppointmentRoute() {
  const { date, time, appt } = newAppointmentRoute.useSearch();
  return <AppointmentForm date={date} time={time} appt={appt} />;
}

// Placeholder: Task 8 replaces this with the real ShareLanding (a summary +
// disabled "Сподели" + "Готово" back to the day). This only exists so the
// form's `navigate({ to: '/appointment/saved' })` type-checks and the funnel
// can be smoke-tested end to end now.
const appointmentSavedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/appointment/saved',
  component: AppointmentSavedPlaceholder,
});

function AppointmentSavedPlaceholder() {
  const draft = useBookingDraft();
  return (
    <main
      style={{
        display: 'grid',
        placeItems: 'center',
        minHeight: '60vh',
        textAlign: 'center',
        padding: 24,
      }}
    >
      <div>
        <h1>{t('booking.saved.placeholder.title')}</h1>
        <p>{t('shell.soon')}</p>
        {draft.appointmentId && <p>{draft.appointmentId}</p>}
      </div>
    </main>
  );
}

const routeTree = rootRoute.addChildren([
  todayRoute,
  clientsRoute,
  settingsRoute,
  bookRoute,
  newAppointmentRoute,
  appointmentSavedRoute,
]);

export const router = createRouter({
  routeTree,
  basepath: import.meta.env.BASE_URL,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
