import { Link, Outlet, useLocation } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { getSettings } from '../settings';
import { t } from '../i18n';
import { FirstRunChooser } from './FirstRunChooser';

// Bottom tab bar ported from docs/design/epic-4/schedule-and-booking-flow.html
// Mode-aware (#7): provider keeps the four Epic-4 tabs; client gets
// Home + Settings. While mode is null the chooser replaces the outlet
// (except on /import, where a successful import infers client mode).
export function AppShell() {
  const settings = useLiveQuery(() => getSettings(), []);
  const { pathname } = useLocation();

  if (settings === undefined) return null; // loading — no flash
  const mode = settings.mode;
  // endsWith, not equality: TanStack Router's location.pathname may carry
  // the basepath (/when-again/import). No other route ends with /import.
  if (mode === null && !pathname.endsWith('/import')) {
    return <FirstRunChooser />;
  }

  return (
    <div className="bg-bg text-ink flex min-h-dvh flex-col">
      <div className="flex-1">
        <Outlet />
      </div>
      <nav
        className={`border-line bg-surface sticky bottom-0 z-[1] grid items-end border-t px-1.5 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] ${mode === 'provider' ? 'grid-cols-4' : 'grid-cols-2'}`}
        aria-label={t('shell.nav.label')}
      >
        {mode === 'provider' ? (
          <>
            <Link
              to="/"
              className="text-faint data-[status=active]:text-accent flex flex-col items-center gap-[3px] text-center text-[10px] no-underline data-[status=active]:font-semibold"
              activeOptions={{ exact: true }}
            >
              <span className="text-base leading-none" aria-hidden="true">
                ▤
              </span>
              {t('shell.tab.today')}
            </Link>
            <Link
              to="/clients"
              className="text-faint data-[status=active]:text-accent flex flex-col items-center gap-[3px] text-center text-[10px] no-underline data-[status=active]:font-semibold"
            >
              <span className="text-base leading-none" aria-hidden="true">
                ☺
              </span>
              {t('shell.tab.clients')}
            </Link>
            <Link
              to="/book"
              className="text-accent flex flex-col items-center gap-[5px] text-center text-[10px] font-semibold no-underline"
            >
              <span
                className="border-surface bg-accent text-on-accent shadow-fab -mb-[13px] grid size-12 -translate-y-[15px] place-items-center rounded-full border-[3px] text-2xl leading-none"
                aria-hidden="true"
              >
                ＋
              </span>
              {t('shell.tab.new')}
            </Link>
            <Link
              to="/settings"
              className="text-faint data-[status=active]:text-accent flex flex-col items-center gap-[3px] text-center text-[10px] no-underline data-[status=active]:font-semibold"
            >
              <span className="text-base leading-none" aria-hidden="true">
                ⚙
              </span>
              {t('shell.tab.settings')}
            </Link>
          </>
        ) : (
          <>
            <Link
              to="/"
              className="text-faint data-[status=active]:text-accent flex flex-col items-center gap-[3px] text-center text-[10px] no-underline data-[status=active]:font-semibold"
              activeOptions={{ exact: true }}
            >
              <span className="text-base leading-none" aria-hidden="true">
                ▤
              </span>
              {t('shell.tab.home')}
            </Link>
            <Link
              to="/settings"
              className="text-faint data-[status=active]:text-accent flex flex-col items-center gap-[3px] text-center text-[10px] no-underline data-[status=active]:font-semibold"
            >
              <span className="text-base leading-none" aria-hidden="true">
                ⚙
              </span>
              {t('shell.tab.settings')}
            </Link>
          </>
        )}
      </nav>
    </div>
  );
}
