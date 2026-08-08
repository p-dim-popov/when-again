import type { Language } from './types';

interface NavigatorLanguages {
  languages?: readonly string[];
  language?: string;
}

export function detectLanguage(nav: NavigatorLanguages = navigator): Language {
  const languages = nav.languages ?? (nav.language ? [nav.language] : []);
  for (const entry of languages) {
    const primary = entry.toLowerCase().split('-')[0];
    if (primary === 'bg') return 'bg';
    if (primary === 'en') return 'en';
  }
  return 'en';
}
