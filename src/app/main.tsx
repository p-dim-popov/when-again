import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { createQueryClient } from './queryClient';
import { getSettings } from '../modules/settings';
import {
  detectLanguage,
  initI18n,
  registerStrings,
  type Language,
} from '../modules/i18n';
import { shellStrings } from '../modules/shell';
import { scheduleStrings } from '../modules/schedule';
import { bookingStrings } from '../modules/booking';
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
  registerStrings('en', {
    ...shellStrings.en,
    ...scheduleStrings.en,
    ...bookingStrings.en,
  });
  registerStrings('bg', {
    ...shellStrings.bg,
    ...scheduleStrings.bg,
    ...bookingStrings.bg,
  });
  let language: Language;
  try {
    const settings = await getSettings();
    language = settings.language ?? detectLanguage();
  } catch {
    language = detectLanguage();
  }
  initI18n(language);

  const queryClient = createQueryClient();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>,
  );
}

void bootstrap();
