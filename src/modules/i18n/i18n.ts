import type { TranslationKeys } from './index';
import type { Language, StringValue, Strings, TParams } from './types';

const registry: Record<Language, Strings> = { bg: {}, en: {} };
let active: Language = 'en';
const pluralRulesCache: Partial<Record<Language, Intl.PluralRules>> = {};

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
  // Plural keys resolve with count 0 ('other') when the caller forgot
  // params.count — documented footgun: plural strings must be called with
  // a count.
  const count = Number(params?.count ?? 0);
  const rules = (pluralRulesCache[active] ??= new Intl.PluralRules(active));
  const category = rules.select(count);
  const form = value[category] ?? value.other;
  return form === undefined ? key : interpolate(form, params);
}
