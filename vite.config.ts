import { defineConfig } from 'vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Base path is configurable so a future custom domain (base '/') is a
// config change, not a refactor.
const base = process.env.BASE_PATH ?? '/when-again/';

export default defineConfig({
  base,
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
      manifest: {
        name: 'when-again',
        short_name: 'when-again',
        description: 'Appointment reminders. No server. No accounts. No fees.',
        theme_color: '#1f2937',
        background_color: '#ffffff',
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
  ],
});
