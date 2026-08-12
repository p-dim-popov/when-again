import { describe, expect, it } from 'vitest';
import { exportBackup } from '../backup';
import { backupFileName, readBackupText } from './backupFile';

describe('backupFileName', () => {
  it('names the file by export date', () => {
    expect(backupFileName('2026-08-12T09:30:00.000Z')).toBe(
      'when-again-backup-2026-08-12.json',
    );
  });
});

describe('readBackupText', () => {
  it('round-trips a real export', async () => {
    const backup = await exportBackup();
    const parsed = readBackupText(JSON.stringify(backup));
    expect(parsed.app).toBe('when-again');
    expect(parsed.exportedAt).toBe(backup.exportedAt);
  });

  it('throws on non-JSON text', () => {
    expect(() => readBackupText('not json')).toThrow();
  });

  it('throws on valid JSON that is not a backup', () => {
    expect(() => readBackupText('{"hello":1}')).toThrow();
  });
});
