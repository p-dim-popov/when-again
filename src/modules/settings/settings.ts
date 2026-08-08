import { getDb, STORE_SETTINGS } from '../db';

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

export async function getSettings(): Promise<Settings> {
  const db = await getDb();
  const stored = (await db.get(STORE_SETTINGS, SINGLETON_ID)) as
    StoredSettings | undefined;
  if (!stored) return { ...DEFAULT_SETTINGS };
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, ...settings } = stored;
  return { ...DEFAULT_SETTINGS, ...settings };
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
  const db = await getDb();
  await db.put(STORE_SETTINGS, {
    id: SINGLETON_ID,
    ...settings,
  } satisfies StoredSettings);
}
