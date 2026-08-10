import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { defineAppointmentsStore } from '../modules/appointments';
import { defineClientsStore } from '../modules/clients';
import { db } from '../modules/db';
import { defineReceivedStore } from '../modules/received';
import { defineSettingsStore, getSettings } from '../modules/settings';
import {
  detectLanguage,
  initI18n,
  registerStrings,
  type Language,
} from '../modules/i18n';
import { shellStrings } from '../modules/shell';
import { scheduleStrings } from '../modules/schedule';
import { bookingStrings } from '../modules/booking';
import { handoffStrings } from '../modules/handoff';
import '@fontsource/lora/cyrillic-500.css';
import '@fontsource/lora/cyrillic-600.css';
import '@fontsource/lora/latin-500.css';
import '@fontsource/lora/latin-600.css';
import '@fontsource/ibm-plex-sans/cyrillic-400.css';
import '@fontsource/ibm-plex-sans/cyrillic-500.css';
import '@fontsource/ibm-plex-sans/cyrillic-600.css';
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import './index.css';

async function bootstrap() {
  defineAppointmentsStore(db);
  defineClientsStore(db);
  defineSettingsStore(db);
  defineReceivedStore(db);

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
  } catch {
    language = detectLanguage();
  }
  initI18n(language);

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
