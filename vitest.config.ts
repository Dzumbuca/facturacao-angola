import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // `server-only` lançava em ambiente Node puro; nos testes basta o marcador.
      'server-only': path.resolve(__dirname, './src/test/server-only-shim.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/lib/**/*.test.ts', 'src/app/api/**/*.test.ts'],
    pool: 'forks',
    poolOptions: {
      // Run integration tests sequentially inside ONE fork so the disposable
      // PostgreSQL connection pool is not exhausted by parallel workers.
      // Each fork would otherwise open up to ~17 connections from Prisma.
      forks: {
        singleFork: true,
      },
    },
    // Tests share state across files in single fork mode. Provide a reasonable
    // timeout so concurrency tests can finish.
    testTimeout: 120_000,
  },
});
