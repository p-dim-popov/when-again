import { RouterProvider } from '@tanstack/react-router';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { UpdateBanner } from '../modules/shell';
import { router } from './router';

// Hourly floor for re-checking the service worker. A standalone PWA left open
// rarely navigates, so the browser's own ~24h check is too slow; the
// foreground/focus listeners below cover the common "return to the app" case,
// and this interval catches an app that stays open untouched.
const UPDATE_POLL_MS = 60 * 60 * 1000;

// Composition root for the running app: mounts the router and wires the PWA
// update flow (#24). registerType is 'prompt' (see vite.config.ts), so a new
// deploy never reloads mid-booking — instead `needRefresh` flips and the
// non-blocking UpdateBanner lets the provider reload when ready.
export function App() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      // Re-check proactively when the app comes back to the foreground — this
      // is what makes a returning user pick up a fresh deploy promptly.
      const recheck = () => {
        if (document.visibilityState === 'visible') void registration.update();
      };
      document.addEventListener('visibilitychange', recheck);
      window.addEventListener('focus', recheck);
      window.setInterval(() => void registration.update(), UPDATE_POLL_MS);
    },
  });

  return (
    <>
      <RouterProvider router={router} />
      <UpdateBanner
        visible={needRefresh}
        onRefresh={() => void updateServiceWorker(true)}
      />
    </>
  );
}
