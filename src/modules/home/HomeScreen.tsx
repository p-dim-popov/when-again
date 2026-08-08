import { t, type Language } from '../i18n';
import { applyLanguageChoice } from './switchLanguage';

// TEMPORARY language toggle — removed when the Settings UI epic ships the real
// control. Both call the same applyLanguageChoice contract.
function TempLanguageToggle() {
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
        {t('home.lang.auto')}
      </button>
    </p>
  );
}

export function HomeScreen() {
  return (
    <main>
      <h1>{t('home.title')}</h1>
      <p>{t('home.tagline')}</p>
      <TempLanguageToggle />
    </main>
  );
}
