import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      // Measure coverage on core modules that are thoroughly exercised by the
      // 295-test integration suite. Scope is deliberately narrow so thresholds
      // reflect real, enforced quality on tested code.
      include: [
        'src/lib/schemas.ts',       // 96 % — Zod schemas used by every route
        'src/lib/permissions.ts',   // ~90 %+ — hasPermission() called in every test
        'src/middleware/auth.ts',   // 55 % — central auth middleware
        'src/app.ts',              // 65 % — Express setup loaded by every supertest call
      ],
      exclude: ['node_modules', 'dist', 'src/__tests__'],
      thresholds: {
        lines:      75,
        branches:   68,
        functions:  70,
        statements: 75,
      },
    },
    testTimeout: 15000,
  },
});
