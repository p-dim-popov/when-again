export type Language = 'bg' | 'en';
export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>>;
export type StringValue = string | PluralForms;
export type Strings = Record<string, StringValue>;
export type TParams = Record<string, string | number>;
