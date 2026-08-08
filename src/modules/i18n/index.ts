// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- augmented per-module via `declare module '../i18n'`
export interface TranslationKeys {}
export { getActiveLanguage, initI18n, registerStrings, t } from './i18n';
export type {
  Language,
  PluralForms,
  Strings,
  StringValue,
  TParams,
} from './types';
