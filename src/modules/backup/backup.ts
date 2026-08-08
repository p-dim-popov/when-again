import {
  listAllAppointments,
  replaceAllAppointments,
  type Appointment,
} from '../appointments';
import { listClients, replaceAllClients, type Client } from '../clients';
import { replaceSettings, updateSettings, type Settings } from '../settings';

export const BACKUP_VERSION = 1;

export interface BackupFile {
  app: 'when-again';
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  settings: Settings;
  clients: Client[];
  appointments: Appointment[];
}

const STALE_AFTER_DAYS = 31;

export async function exportBackup(
  now: Date = new Date(),
): Promise<BackupFile> {
  const exportedAt = now.toISOString();
  const settings = await updateSettings({ lastBackupAt: exportedAt });
  return {
    app: 'when-again',
    version: BACKUP_VERSION,
    exportedAt,
    settings,
    clients: await listClients(),
    appointments: await listAllAppointments(),
  };
}

export function parseBackup(data: unknown): BackupFile {
  if (typeof data !== 'object' || data === null)
    throw new Error('invalid backup file');
  const d = data as Record<string, unknown>;
  if (
    d.app !== 'when-again' ||
    d.version !== BACKUP_VERSION ||
    typeof d.exportedAt !== 'string' ||
    typeof d.settings !== 'object' ||
    d.settings === null ||
    !Array.isArray(d.clients) ||
    !Array.isArray(d.appointments)
  ) {
    throw new Error('invalid backup file');
  }
  return data as BackupFile;
}

export async function importBackup(data: unknown): Promise<void> {
  const backup = parseBackup(data);
  await replaceSettings(backup.settings);
  await replaceAllClients(backup.clients);
  await replaceAllAppointments(backup.appointments);
}

export function isBackupStale(
  lastBackupAt: string | null,
  now: Date = new Date(),
): boolean {
  if (!lastBackupAt) return true;
  const ageMs = now.getTime() - new Date(lastBackupAt).getTime();
  return ageMs > STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;
}
