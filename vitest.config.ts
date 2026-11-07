import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // `server-only` lança em ambiente Node puro; nos testes basta o marcador.
      'server-only': path.resolve(__dirname, './src/test/server-only-shim.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/lib/**/*.test.ts', 'src/app/api/**/*.test.ts'],
  },
});
