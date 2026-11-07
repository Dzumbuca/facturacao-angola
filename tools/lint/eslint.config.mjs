import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import nextPlugin from '@next/eslint-plugin-next';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    ignores: [
      '.next/**',
      '.next-*/**',
      'out/**',
      'build/**',
      'dist-desktop/**',
      'dist-electron/**',
      'output/**',
      'node_modules/**',
      'tools/lint/node_modules/**',
      'next-env.d.ts',
      '**/*.d.ts',
    ],
  },
  nextPlugin.configs.recommended,
  nextPlugin.configs['core-web-vitals'],
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: { '@typescript-eslint': tsPlugin, 'react-hooks': reactHooks },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Regras clássicas do react-hooks (as do React Compiler exigem configuração própria).
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  },
  {
    rules: {
      // A aplicação usa <img> deliberadamente para logos/faturas (sem next/image).
      '@next/next/no-img-element': 'off',
    },
  },
];
