import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { exportBackup, isBackupStale, type BackupFile } from '../backup';
import { t } from '../i18n';
import { getSettings } from '../settings';
import { applyImportedBackup } from './applyImport';
import { backupFileName, readBackupText } from './backupFile';

type ImportState =
  | { step: 'idle' }
  | { step: 'confirm'; backup: BackupFile }
  | { step: 'invalid' }
  | { step: 'importFailed' };

// Backup UI (#7): first UI over the Epic-3 backup module. Export downloads
// the JSON (exportBackup stamps lastBackupAt itself); import validates,
// then asks for explicit confirmation before replacing everything.
// A successful import reloads the page (see applyImportedBackup) so the
// running UI re-derives theme/language/mode from the imported settings —
// that reload is the confirmation; there is no "done" state to render.
export function BackupSection() {
  const settings = useLiveQuery(() => getSettings(), []);
  const [importState, setImportState] = useState<ImportState>({ step: 'idle' });
  const [exportFailed, setExportFailed] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const download = async () => {
    try {
      setExportFailed(false);
      const backup = await exportBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = backupFileName(backup.exportedAt);
      document.body.appendChild(a);
      a.click();
      a.remove();
      // WebKit/standalone-PWA hazard: revoking immediately can cut the
      // download off before it starts, so defer it a tick.
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      setExportFailed(true);
    }
  };

  const onFilePicked = async (file: File | undefined) => {
    if (!file) return;
    try {
      setImportState({
        step: 'confirm',
        backup: readBackupText(await file.text()),
      });
    } catch {
      setImportState({ step: 'invalid' });
    }
  };

  const confirmImport = async (backup: BackupFile) => {
    try {
      await applyImportedBackup(backup);
    } catch {
      setImportState({ step: 'importFailed' });
    }
  };

  if (settings === undefined) return null;
  const last = settings.lastBackupAt;

  return (
    <section className="flex flex-col gap-2" data-testid="backup-section">
      <h2 className="text-faint text-sm font-semibold">
        {t('shell.settings.backup.title')}
      </h2>
      <p className="text-faint text-sm">
        {last
          ? t('shell.settings.backup.last', { date: last.slice(0, 10) })
          : t('shell.settings.backup.never')}
      </p>
      {last !== null && isBackupStale(last) && (
        <p className="text-faint text-sm" data-testid="backup-stale">
          {t('shell.settings.backup.stale')}
        </p>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => void download()}
          className="bg-accent text-on-accent rounded-card cursor-pointer border-0 px-4 py-2 text-sm font-[650]"
        >
          {t('shell.settings.backup.export')}
        </button>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="border-line bg-surface text-ink rounded-card cursor-pointer border px-4 py-2 text-sm"
        >
          {t('shell.settings.backup.import')}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          data-testid="backup-file-input"
          onChange={(e) => {
            void onFilePicked(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
      {exportFailed && (
        <p className="text-danger text-sm" role="status">
          {t('shell.settings.backup.exportFailed')}
        </p>
      )}
      {importState.step === 'confirm' && (
        <div className="border-line bg-surface rounded-card flex flex-col gap-2 border p-3">
          <p className="text-ink text-sm">
            {t('shell.settings.backup.confirm', {
              date: importState.backup.exportedAt.slice(0, 10),
            })}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              data-testid="backup-confirm"
              onClick={() => void confirmImport(importState.backup)}
              className="bg-accent text-on-accent rounded-card cursor-pointer border-0 px-4 py-2 text-sm font-[650]"
            >
              {t('shell.settings.backup.confirmAction')}
            </button>
            <button
              type="button"
              onClick={() => setImportState({ step: 'idle' })}
              className="border-line bg-surface text-ink rounded-card cursor-pointer border px-4 py-2 text-sm"
            >
              {t('shell.settings.backup.cancelAction')}
            </button>
          </div>
        </div>
      )}
      {importState.step === 'invalid' && (
        <p className="text-danger text-sm" role="status">
          {t('shell.settings.backup.invalid')}
        </p>
      )}
      {importState.step === 'importFailed' && (
        <p className="text-danger text-sm" role="status">
          {t('shell.settings.backup.importFailed')}
        </p>
      )}
    </section>
  );
}
