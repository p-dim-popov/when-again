import { defineConfig } from 'vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';

// Base path is configurable so a future custom domain (base '/') is a
// config change, not a refactor.
const base = process.env.BASE_PATH ?? '/when-again/';

// Build identity (#33): computed once here, used three ways — baked into the
// bundle via `define`, published as dist/version.json, and turned into a git
// tag by the deploy workflow. Minute precision, UTC.
const builtAt = `${new Date().toISOString().slice(0, 16)}:00Z`;
// Building from a source tarball (no .git) must still succeed, so a missing
// git binary/repo falls back to 'unknown' instead of failing the build.
let commit: string;
try {
  commit = execSync('git rev-parse --short HEAD').toString().trim();
} catch {
  commit = 'unknown';
}
const buildInfo = {
  version: `${builtAt.slice(0, 10)}-${builtAt.slice(11, 13)}${builtAt.slice(14, 16)}`,
  commit,
  builtAt,
};

export default defineConfig({
  base,
  define: {
    __BUILD_VERSION__: JSON.stringify(buildInfo.version),
    __BUILD_COMMIT__: JSON.stringify(buildInfo.commit),
    __BUILD_DATE__: JSON.stringify(buildInfo.builtAt),
  },
  plugins: [
    // Must precede the React plugin. Routes live inside the composition root
    // (`src/app/routes`) so nothing outside `src/app/` imports them, and the
    // generated tree is committed (it sits beside `router.tsx`) so the
    // standalone `tsc -b` typecheck has it without a Vite run.
    tanstackRouter({
      target: 'react',
      routesDirectory: 'src/app/routes',
      generatedRouteTree: 'src/app/routeTree.gen.ts',
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt' (not 'autoUpdate'): a new deploy must never reload the page
      // out from under an in-progress booking (the draft lives in memory).
      // src/app registers the SW explicitly, re-checks on foreground, and
      // surfaces a non-blocking "refresh" banner the provider taps when ready
      // (see src/app/App.tsx and modules/shell/UpdateBanner). See issue #24.
      registerType: 'prompt',
      // version.json names the *currently deployed* build; if the SW
      // precached it, the app would forever read its own (stale) copy and
      // "check for updates" would always say up-to-date. Clients fetch it
      // with { cache: 'no-store' } (see modules/shell/VersionFooter).
      workbox: { globIgnores: ['**/version.json'] },
      manifest: {
        name: 'when-again',
        short_name: 'when-again',
        description: 'Appointment reminders. No server. No accounts. No fees.',
        // Keep in sync with the light --bg token in src/app/index.css (the
        // manifest takes one value; the per-scheme theme-color metas in
        // index.html handle dark at runtime).
        theme_color: '#efebe2',
        background_color: '#efebe2',
        display: 'standalone',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
    {
      name: 'emit-version-json',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: `${JSON.stringify(buildInfo, null, 2)}\n`,
        });
      },
    },
  ],
});
