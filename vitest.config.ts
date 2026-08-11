import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Fixed stand-ins for the build identity that vite.config.ts derives from
  // git and the build clock — tests must not depend on either.
  define: {
    __BUILD_VERSION__: JSON.stringify('2026-01-02-0304'),
    __BUILD_COMMIT__: JSON.stringify('testsha'),
    __BUILD_DATE__: JSON.stringify('2026-01-02T03:04:00Z'),
  },
  test: {
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test/setup-db.ts'],
    passWithNoTests: true,
  },
});
