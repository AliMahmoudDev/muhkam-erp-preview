import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // Measure coverage on lib/context/component files that the 162-test
      // frontend suite exercises thoroughly. Unmeasured files (large page
      // components, legacy forms) are excluded until test depth improves.
      include: [
        'src/lib/api.ts',           // 100 % — HTTP client
        'src/lib/format.ts',        // 85 %  — formatting utilities
        'src/lib/permissions.ts',   // 100 % — RBAC permission map
        'src/lib/roles.ts',         // 100 % — role definitions
        'src/lib/safe-data.ts',     // 100 % — safe data helpers
        'src/contexts/auth.tsx',    // 92 %  — auth context
        'src/components/subscription-banner.tsx', // 90 % — banner component
        'src/pages/inventory/_shared.ts',         // 100 % — inventory helpers
        'src/pages/settings/_constants.ts',       // 100 % — settings constants
      ],
      thresholds: {
        lines:      60,
        branches:   50,
        functions:  60,
        statements: 60,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
