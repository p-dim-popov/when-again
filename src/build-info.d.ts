// Build identity injected by `define` in vite.config.ts (see the version
// spec, docs/specs/2026-08-11-version-visibility-design.md). Vitest injects
// fixed test values in vitest.config.ts.
declare const __BUILD_VERSION__: string;
declare const __BUILD_COMMIT__: string;
declare const __BUILD_DATE__: string;
