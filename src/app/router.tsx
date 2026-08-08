import {
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { AppShell, Placeholder } from '../modules/shell';

const rootRoute = createRootRoute({
  component: AppShell,
});

const todayRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  // Temporary: the schedule (Днес) screen ships in Task 3.
  component: () => <Placeholder titleKey="shell.tab.today" />,
});

const clientsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/clients',
  component: () => <Placeholder titleKey="shell.placeholder.clients" />,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: () => <Placeholder titleKey="shell.placeholder.settings" />,
});

const bookRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/book',
  // Temporary: the month-picker booking funnel ships in a later task.
  component: () => <Placeholder titleKey="shell.tab.new" />,
});

const routeTree = rootRoute.addChildren([
  todayRoute,
  clientsRoute,
  settingsRoute,
  bookRoute,
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
