import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './router';
import { createQueryClient } from './queryClient';
import { getSettings } from '../modules/settings';
import {
  detectLanguage,
  initI18n,
  registerStrings,
  type Language,
} from '../modules/i18n';
import { homeStrings } from '../modules/home';
import { shellStrings } from '../modules/shell';
import './index.css';

async function bootstrap() {
  registerStrings('en', homeStrings.en);
  registerStrings('bg', homeStrings.bg);
  registerStrings('en', shellStrings.en);
  registerStrings('bg', shellStrings.bg);
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
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  );
}

void bootstrap();
