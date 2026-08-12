import type { Language } from '../i18n';
import { updateSettings } from '../settings';

export interface SwitchDeps {
  reload: () => void;
}

const defaultDeps: SwitchDeps = { reload: () => location.reload() };

// Powers the Settings-screen language control: persist + reload (strings
// resolve once at boot, so a reload is the language-change mechanism).
export async function applyLanguageChoice(
  language: Language | null,
  deps: SwitchDeps = defaultDeps,
): Promise<void> {
  await updateSettings({ language });
  deps.reload();
}
