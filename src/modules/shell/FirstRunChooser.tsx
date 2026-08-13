import { t } from '../i18n';
import { updateSettings, type Mode } from '../settings';

// First-run mode chooser (#7). Rendered by AppShell instead of the outlet
// while settings.mode is null (except on /import, where inference decides).
// Persisting the choice removes it reactively — no route, no redirect.
export function FirstRunChooser() {
  const choose = (mode: Mode) => {
    void updateSettings({ mode });
  };
  return (
    <main className="fixed inset-x-0 top-0 flex h-[var(--app-h,100dvh)] flex-col items-center justify-center gap-6 overflow-y-auto p-6 text-center">
      <h1 className="text-ink font-display text-2xl">
        {t('shell.chooser.title')}
      </h1>
      <div className="flex w-full max-w-sm flex-col gap-3">
        <button
          type="button"
          data-testid="chooser-client"
          onClick={() => choose('client')}
          className="border-line bg-surface rounded-card cursor-pointer border px-5 py-4 text-left"
        >
          <span className="text-ink block font-[650]">
            {t('shell.chooser.client')}
          </span>
          <span className="text-faint block text-sm">
            {t('shell.chooser.clientHint')}
          </span>
        </button>
        <button
          type="button"
          data-testid="chooser-provider"
          onClick={() => choose('provider')}
          className="border-line bg-surface rounded-card cursor-pointer border px-5 py-4 text-left"
        >
          <span className="text-ink block font-[650]">
            {t('shell.chooser.provider')}
          </span>
          <span className="text-faint block text-sm">
            {t('shell.chooser.providerHint')}
          </span>
        </button>
      </div>
      <p className="text-faint text-sm">{t('shell.chooser.note')}</p>
    </main>
  );
}
