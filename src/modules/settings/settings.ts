import Dexie, { type EntityTable } from 'dexie';
import { db } from '../db';

export interface ServicePreset {
  name: string;
  durationMinutes: number;
  price?: number;
}

export type Language = 'bg' | 'en';
export type Mode = 'provider' | 'client';

export interface Settings {
  providerName: string;
  address?: string;
  services: ServicePreset[];
  language: Language | null;
  mode: Mode | null;
  /** ISO timestamp of the last backup export, null if never backed up. */
  lastBackupAt: string | null;
}

export const DEFAULT_SETTINGS: Settings = {
  providerName: '',
  services: [],
  language: null,
  mode: null,
  lastBackupAt: null,
};

const SINGLETON_ID = 'singleton';
type StoredSettings = Settings & { id: typeof SINGLETON_ID };

declare module '../db' {
  interface WhenAgainDB {
    settings: EntityTable<StoredSettings, 'id'>;
  }
}

export function defineSettingsStore(db: Dexie): void {
  db.version(1).stores({ settings: 'id' });
}

export async function getSettings(): Promise<Settings> {
  const stored = await db.settings.get(SINGLETON_ID);
  // Fresh services array each call: DEFAULT_SETTINGS.services must never be
  // shared/mutated across callers.
  const defaults: Settings = { ...DEFAULT_SETTINGS, services: [] };
  if (!stored) return defaults;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, ...settings } = stored;
  return { ...defaults, ...settings };
}

export async function updateSettings(
  patch: Partial<Settings>,
): Promise<Settings> {
  const current = await getSettings();
  const next = { ...current, ...patch };
  await replaceSettings(next);
  return next;
}

export async function replaceSettings(settings: Settings): Promise<void> {
  await db.settings.put({
    id: SINGLETON_ID,
    ...settings,
  } satisfies StoredSettings);
}
