import type { Language } from '../i18n';
import { updateSettings } from '../settings';

export interface SwitchDeps {
  reload: () => void;
}

const defaultDeps: SwitchDeps = { reload: () => location.reload() };

// TEMPORARY: powers the settings-screen language toggle until Epic 7 ships
// the real Settings screen (and the provider/client mode switch). That
// control calls the same persist + reload contract, so removing this widget
// does not touch the mechanism.
export async function applyLanguageChoice(
  language: Language | null,
  deps: SwitchDeps = defaultDeps,
): Promise<void> {
  await updateSettings({ language });
  deps.reload();
}
