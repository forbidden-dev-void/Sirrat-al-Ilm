import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite configuration
 * ------------------
 * Development:  `npm run dev` serves the SPA on :5173 and proxies every /api
 *               request to the FastAPI backend on :8000, so the browser only
 *               ever talks to one origin (no CORS surprises).
 * Production:   `npm run build` emits static files into dist/, which the
 *               backend serves directly from /  (see scripts/build.sh).
 * Unit tests:   `vitest.config.ts` holds the Vitest-specific settings (kept
 *               separate so Vite and Vitest never disagree on plugin types).
 *
 * `allowedHosts: true` is required because the app is previewed through a
 * tunnel host (https://{port}-{sandbox}.e2b.app) rather than localhost.
 */
const API_TARGET = process.env.VITE_PROXY_TARGET ?? 'http://127.0.0.1:8000';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        /**
         * Split the vendor bundles so the first paint stays small and so a
         * dependency bump does not invalidate the application chunk.
         * The order of the checks matters: react-router-dom also contains the
         * string "react", so it must be matched first.
         */
        manualChunks(id: string): string | undefined {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('react-router')) return 'router';
          if (id.includes('react-dom') || id.includes('/react/')) return 'react';
          return 'vendor';
        },
      },
    },
  },
});
