// Typed access to the build identity baked in by `define` (vite.config.ts).
// Display-only: the app never compares versions to decide old-vs-new — the
// browser's byte-comparison of sw.js is the sole update-detection mechanism.
export const buildInfo = {
  version: __BUILD_VERSION__,
  commit: __BUILD_COMMIT__,
  builtAt: __BUILD_DATE__,
  dev: import.meta.env.DEV,
};

// '2026-08-11T14:32:00Z' → '2026-08-11 14:32 UTC'
export function formatBuiltAt(builtAt: string): string {
  return `${builtAt.slice(0, 10)} ${builtAt.slice(11, 16)} UTC`;
}

// → '2026-08-11 14:32 UTC · bd12529'
export function formatStamp(info: { builtAt: string; commit: string }): string {
  return `${formatBuiltAt(info.builtAt)} · ${info.commit}`;
}
