import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals:     true,
    environment: 'node',
    include:     ['src/__tests__/integration/**/*.test.ts'],
    setupFiles:  ['./src/__tests__/integration/setup.ts'],
    testTimeout: 60000,
    hookTimeout: 60000,
    pool:        'forks',
    isolate:     true,
    // تشغيل ملفات الاختبار بالتسلسل لمنع التعارض على قاعدة البيانات
    maxWorkers:  1,
    minWorkers:  1,
  },
});
