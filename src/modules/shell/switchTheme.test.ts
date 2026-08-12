import { describe, expect, it } from 'vitest';
import { getSettings } from '../settings';
import { applyThemeAttribute, applyThemeChoice } from './switchTheme';

function fakeRoot(): { dataset: DOMStringMap } {
  return { dataset: {} as DOMStringMap };
}

describe('applyThemeAttribute', () => {
  it('sets data-theme for an explicit choice', () => {
    const root = fakeRoot();
    applyThemeAttribute('dark', root);
    expect(root.dataset.theme).toBe('dark');
  });

  it('removes data-theme for auto so prefers-color-scheme rules', () => {
    const root = fakeRoot();
    root.dataset.theme = 'dark';
    applyThemeAttribute(null, root);
    expect(root.dataset.theme).toBeUndefined();
  });
});

describe('applyThemeChoice', () => {
  it('persists the choice and applies it', async () => {
    const root = fakeRoot();
    await applyThemeChoice('light', root);
    expect((await getSettings()).theme).toBe('light');
    expect(root.dataset.theme).toBe('light');
  });
});
