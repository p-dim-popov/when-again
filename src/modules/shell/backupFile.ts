import { parseBackup, type BackupFile } from '../backup';

export function readBackupText(text: string): BackupFile {
  return parseBackup(JSON.parse(text) as unknown);
}

export function backupFileName(exportedAt: string): string {
  return `when-again-backup-${exportedAt.slice(0, 10)}.json`;
}
