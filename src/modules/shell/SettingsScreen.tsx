import { t, type Language } from '../i18n';
import { applyLanguageChoice } from './switchLanguage';
import { VersionFooter } from './VersionFooter';

// TEMPORARY language toggle — removed when Epic 7 ships the real Settings
// screen (and the provider/client mode switch). Both call the same
// applyLanguageChoice contract, so the permanent control is a drop-in
// replacement for this widget.
function LanguageToggle() {
  const choose = (language: Language | null) => {
    void applyLanguageChoice(language);
  };
  return (
    <p>
      <button type="button" onClick={() => choose('bg')}>
        БГ
      </button>{' '}
      <button type="button" onClick={() => choose('en')}>
        EN
      </button>{' '}
      <button type="button" onClick={() => choose(null)}>
        {t('shell.settings.lang.auto')}
      </button>
    </p>
  );
}

// TEMPORARY Settings screen for Epic 4. Epic 7 replaces this with the real
// Settings screen (services, providers) and the provider/client mode switch;
// until then this keeps the language toggle reachable from the app.
export function SettingsScreen() {
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
        <h1>{t('shell.placeholder.settings')}</h1>
        <p>{t('shell.soon')}</p>
        <p>{t('shell.settings.tagline')}</p>
        <LanguageToggle />
        <VersionFooter />
      </div>
    </main>
  );
}
