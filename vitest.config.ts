import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'server-only': path.resolve(__dirname, './src/test/server-only-shim.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/lib/**/*.test.ts', 'src/app/api/**/*.test.ts'],
    // Run all tests in ONE worker process (single-file isolation),
    // so the disposable PostgreSQL connection pool is bounded to one
    // PrismaClient pool instead of dozens of parallel workers each
    // opening their own pool.
    maxWorkers: 1,
    testTimeout: 120_000,
  },
});
