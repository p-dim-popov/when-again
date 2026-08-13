import { t } from '../i18n';
import { updateSettings, type Mode } from '../settings';

// The welcome screen (#41). Rendered by AppShell instead of the outlet
// while settings.mode is null (except on /import, where inference decides).
// Persisting the choice removes it reactively — no route, no redirect.
export function FirstRunChooser() {
  const choose = (mode: Mode) => {
    void updateSettings({ mode });
  };
  return (
    <main className="fixed inset-x-0 top-0 flex h-[var(--app-h,100dvh)] flex-col items-center justify-center gap-8 overflow-y-auto p-6 text-center">
      <header className="flex flex-col items-center gap-3">
        <h1 className="text-ink font-display text-[44px] leading-none font-[760] tracking-[-0.02em]">
          When Again
        </h1>
        <p className="text-muted max-w-[28ch] text-[15px] leading-snug">
          {t('shell.welcome.tagline')}
        </p>
      </header>
      <div className="flex w-full max-w-sm flex-col gap-3">
        <p className="text-faint text-[11px] font-semibold tracking-[0.08em] uppercase">
          {t('shell.chooser.title')}
        </p>
        <button
          type="button"
          data-testid="chooser-client"
          onClick={() => choose('client')}
          className="border-line bg-surface rounded-card shadow-card cursor-pointer border px-5 py-4 text-left"
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
          className="border-line bg-surface rounded-card shadow-card cursor-pointer border px-5 py-4 text-left"
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
