import { updateSettings, type Theme } from '../settings';

// Theme control (#7). Unlike the language switch there is no reload: the
// restyle's CSS already flips every token under [data-theme], so applying
// is just setting/removing the attribute on <html>. null = Auto (follow
// prefers-color-scheme). Boot (src/app/main.tsx) re-applies the persisted
// value before first paint.
export function applyThemeAttribute(
  theme: Theme | null,
  root: { dataset: DOMStringMap } = document.documentElement,
): void {
  if (theme === null) delete root.dataset.theme;
  else root.dataset.theme = theme;
}

export async function applyThemeChoice(
  theme: Theme | null,
  root: { dataset: DOMStringMap } = document.documentElement,
): Promise<void> {
  await updateSettings({ theme });
  applyThemeAttribute(theme, root);
}
