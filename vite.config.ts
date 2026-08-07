import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Base path is configurable so a future custom domain (base '/') is a
// config change, not a refactor.
const base = process.env.BASE_PATH ?? '/when-again/';

export default defineConfig({
  base,
  plugins: [react()],
});
