import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';

// Routes are defined file-based under `src/app/routes/`; the tree is generated
// into `routeTree.gen.ts` by the TanStack Router Vite plugin (see
// `vite.config.ts`). This module only assembles the router and registers its
// types.
export const router = createRouter({
  routeTree,
  basepath: import.meta.env.BASE_URL,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
