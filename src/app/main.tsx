import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './router';
import { getSettings } from '../modules/settings';
import {
  detectLanguage,
  initI18n,
  registerStrings,
  type Language,
} from '../modules/i18n';
import { homeStrings } from '../modules/home';
import './index.css';

async function bootstrap() {
  registerStrings('en', homeStrings.en);
  registerStrings('bg', homeStrings.bg);
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
      <RouterProvider router={router} />
    </StrictMode>,
  );
}

void bootstrap();
