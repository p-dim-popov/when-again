import { useEffect, useState } from 'react';
import { wallClockNow } from '../time';

// Minute-grain reactive "now": the home re-renders each minute and on tab
// re-focus, so the countdown and the upcoming/past split never go stale on
// a long-open PWA (the sub-project-1 ClientVisitsList read the clock once
// per render). Minute precision matches the wall-clock format.
export function useTickingNow(): string {
  const [now, setNow] = useState(() => wallClockNow().dateTime);
  useEffect(() => {
    const update = () => setNow(wallClockNow().dateTime);
    const timer = window.setInterval(update, 60_000);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  return now;
}
