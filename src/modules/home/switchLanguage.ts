import type { Language } from '../i18n';
import { updateSettings } from '../settings';

export interface SwitchDeps {
  reload: () => void;
}

const defaultDeps: SwitchDeps = { reload: () => location.reload() };

// TEMPORARY: powers the home-screen language toggle until the Settings UI epic
// adds the permanent control. That control calls the same persist + reload
// contract, so removing this widget does not touch the mechanism.
export async function applyLanguageChoice(
  language: Language | null,
  deps: SwitchDeps = defaultDeps,
): Promise<void> {
  await updateSettings({ language });
  deps.reload();
}
