import type { TranslationKeys } from './index';
import type { Language, StringValue, Strings, TParams } from './types';

const registry: Record<Language, Strings> = { bg: {}, en: {} };
let active: Language = 'en';

export function registerStrings(lang: Language, strings: Strings): void {
  registry[lang] = { ...registry[lang], ...strings };
}

export function initI18n(language: Language): void {
  active = language;
}

export function getActiveLanguage(): Language {
  return active;
}

function interpolate(template: string, params?: TParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match,
  );
}

export function t(
  key: keyof TranslationKeys & string,
  params?: TParams,
): string {
  const value: StringValue | undefined = registry[active][key];
  if (value === undefined) return key;
  if (typeof value === 'string') return interpolate(value, params);
  const count = Number(params?.count ?? 0);
  const category = new Intl.PluralRules(active).select(count);
  const form = value[category] ?? value.other;
  return form === undefined ? key : interpolate(form, params);
}
