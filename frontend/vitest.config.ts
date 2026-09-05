import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration
 * --------------------
 * Kept apart from vite.config.ts on purpose: Vitest ships its own pinned copy
 * of Vite's types, and merging the two configs into one file makes TypeScript
 * compare two structurally identical but nominally different `Plugin` types.
 *
 * The unit tests here are pure TypeScript helpers (no JSX, no DOM), so the
 * node environment is enough and no plugins are required.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: false,
    clearMocks: true,
  },
});
