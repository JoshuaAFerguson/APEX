import { defineConfig, mergeConfig } from 'vitest/config';
import { createIntegrationTestConfig } from '../../vitest.shared.config.js';
import path from 'path';

export default mergeConfig(
  createIntegrationTestConfig({
    testTimeout: 30000,  // Browser tests need more time
    hookTimeout: 30000,
    coverageThresholds: {
      lines: 60,
      functions: 60,
      branches: 60,
      statements: 60,
    },
  }),
  defineConfig({
    test: {
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
          'src/test-utils/**',
          'src/mocks/**',
          'src/permission-mocking/**',
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