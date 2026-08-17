import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { defineAppointmentsStore } from '../modules/appointments';
import { defineClientsStore } from '../modules/clients';
import { db } from '../modules/db';
import { defineReceivedStore } from '../modules/received';
import { defineSavedProvidersStore } from '../modules/savedProviders';
import { defineSettingsStore, getSettings } from '../modules/settings';
import {
  detectLanguage,
  initI18n,
  registerStrings,
  type Language,
} from '../modules/i18n';
import { applyThemeAttribute, shellStrings } from '../modules/shell';
import { scheduleStrings } from '../modules/schedule';
import { bookingStrings } from '../modules/booking';
import { handoffStrings } from '../modules/handoff';
import '@fontsource-variable/sofia-sans-condensed';
import '@fontsource-variable/manrope';
import './index.css';

async function bootstrap() {
  defineAppointmentsStore(db);
  defineClientsStore(db);
  defineSettingsStore(db);
  defineReceivedStore(db);
  defineSavedProvidersStore(db);

  registerStrings('en', {
    ...shellStrings.en,
    ...scheduleStrings.en,
    ...bookingStrings.en,
    ...handoffStrings.en,
  });
  registerStrings('bg', {
    ...shellStrings.bg,
    ...scheduleStrings.bg,
    ...bookingStrings.bg,
    ...handoffStrings.bg,
  });
  let language: Language;
  try {
    const settings = await getSettings();
    language = settings.language ?? detectLanguage();
    applyThemeAttribute(settings.theme);
  } catch {
    language = detectLanguage();
  }
  initI18n(language);
  // Language changes always reload the page (switchLanguage / applyImport),
  // so boot is the only seam that needs to set this. A future reactive
  // language switch must update this too.
  document.documentElement.lang = language;

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
