import { t } from '../i18n';

// Non-blocking "a new version is ready" banner (#24). Presentational only —
// src/app owns the service-worker registration and passes `visible` +
// `onRefresh` down (the app is the composition root; the SW is app-level).
// Pinned to the top above the day view and the time sheet (z-[4] > the
// sheet's z-[3]) so it never covers the bottom nav or the primary actions,
// and the provider chooses when to reload rather than being interrupted.
export function UpdateBanner({
  visible,
  onRefresh,
}: {
  visible: boolean;
  onRefresh: () => void;
}) {
  if (!visible) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[4] flex justify-center px-3 pt-[calc(0.5rem+env(safe-area-inset-top))]"
    >
      <div className="rounded-card border-line bg-surface shadow-sheet flex w-full max-w-sm items-center gap-3 border px-3 py-2">
        <span className="text-ink flex-1 text-sm">
          {t('shell.update.message')}
        </span>
        <button
          type="button"
          onClick={onRefresh}
          className="bg-accent text-on-accent rounded-card shrink-0 cursor-pointer border-0 px-3 py-1.5 text-sm font-[650]"
        >
          {t('shell.update.action')}
        </button>
      </div>
    </div>
  );
}
