import {
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { AppShell, Placeholder, SettingsScreen } from '../modules/shell';
import { ScheduleScreen, todayKey } from '../modules/schedule';
import { MonthPicker } from '../modules/booking';
import { t } from '../modules/i18n';

interface TodaySearch {
  date?: string;
}

interface NewAppointmentSearch {
  date?: string;
  time?: string;
}

const rootRoute = createRootRoute({
  component: AppShell,
});

const todayRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: (search: Record<string, unknown>): TodaySearch => ({
    date: typeof search.date === 'string' ? search.date : undefined,
  }),
  component: TodayRoute,
});

function TodayRoute() {
  const { date } = todayRoute.useSearch();
  return <ScheduleScreen dateKey={date ?? todayKey(new Date())} />;
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

const bookRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/book',
  component: MonthPicker,
});

// Placeholder: the day view (schedule) navigates here on a quick-slot or
// "друг час" pick, passing the choice as search params so `schedule` never
// has to import `booking`. A later dispatch of this task replaces this
// component with the real, draft-backed AppointmentForm.
const newAppointmentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/appointment/new',
  validateSearch: (search: Record<string, unknown>): NewAppointmentSearch => ({
    date: typeof search.date === 'string' ? search.date : undefined,
    time: typeof search.time === 'string' ? search.time : undefined,
  }),
  component: NewAppointmentPlaceholder,
});

function NewAppointmentPlaceholder() {
  const { date, time } = newAppointmentRoute.useSearch();
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
        <h1>{t('booking.new.placeholder.title')}</h1>
        <p>{t('shell.soon')}</p>
        {date && time && (
          <p>{t('booking.new.placeholder.echo', { date, time })}</p>
        )}
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
