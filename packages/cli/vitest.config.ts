import { defineConfig, mergeConfig } from 'vitest/config';
import { createBrowserTestConfig } from '../../vitest.shared.config.js';
import path from 'path';

export default mergeConfig(
  createBrowserTestConfig('jsdom', {
    coverageThresholds: {
      lines: 70,
      functions: 70,
      branches: 70,
      statements: 70,
    },
  }),
  defineConfig({
    test: {
      setupFiles: ['./src/__tests__/setup.ts', '../../test-setup.ts'],

      include: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.integration.test.{ts,tsx}',
        'src/**/*.e2e.test.{ts,tsx}'
      ],

      exclude: [
        'node_modules/**',
        'dist/**',
        'coverage/**',
      ],

      coverage: {
        include: ['src/**/*.{ts,tsx}'],
        exclude: [
          '**/*.test.{ts,tsx}',
          '**/*.integration.test.{ts,tsx}',
          '**/*.e2e.test.{ts,tsx}',
          '**/*.d.ts',
          'src/__tests__/**',
          'src/__mocks__/**',
        ],
      },
    },

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  })
);