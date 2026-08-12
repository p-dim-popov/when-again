import { importBackup, type BackupFile } from '../backup';
import { applyThemeAttribute } from './switchTheme';

export interface ImportDeps {
  reload: () => void;
}

const defaultDeps: ImportDeps = { reload: () => location.reload() };

// Powers the Settings-screen backup import: importBackup() replaces
// settings/clients/appointments in IndexedDB, but the running UI never
// re-derives from the new settings on its own — data-theme and the i18n
// language stay stale. Reloading re-runs boot (src/app/main.tsx), which
// re-applies the persisted theme and re-resolves strings for the persisted
// language, the same reload contract applyLanguageChoice uses. The theme
// attribute is applied here too so there is no stale-UI flash between the
// import resolving and the reload actually happening.
export async function applyImportedBackup(
  backup: BackupFile,
  deps: ImportDeps = defaultDeps,
  root: { dataset: DOMStringMap } = document.documentElement,
): Promise<void> {
  await importBackup(backup);
  applyThemeAttribute(backup.settings.theme, root);
  deps.reload();
}
