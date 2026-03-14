/**
 * Vitest configuration for @apex/web-ui package
 *
 * Uses shared configuration with browser test optimizations
 * for React components and Next.js integration
 */
import { defineConfig, mergeConfig } from 'vitest/config';
import type { UserConfig } from 'vite';
import { createBrowserTestConfig } from '../../vitest.shared.config.js';
import { resolve } from 'path';

export default mergeConfig(
  createBrowserTestConfig('jsdom', {
    testTimeout: 10000,
    coverageThresholds: {
      lines: 60,
      functions: 60,
      branches: 60,
      statements: 60,
    },
  }) as UserConfig,
  defineConfig({
    test: {
      // Next.js and React setup
      setupFiles: ['./src/__tests__/setup.ts', '../../test-setup.ts'],

      // Package-specific includes for Next.js
      include: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.integration.test.{ts,tsx}',
        'src/**/*.component.test.{ts,tsx}',
      ],

      exclude: [
        'node_modules/**',
        '.next/**',
        'out/**',
        'dist/**',
        'coverage/**',
      ],

      // Coverage configuration for Next.js project
      coverage: {
        include: ['src/**/*.{ts,tsx}'],
        exclude: [
          '**/*.test.{ts,tsx}',
          '**/*.integration.test.{ts,tsx}',
          '**/*.component.test.{ts,tsx}',
          '**/*.d.ts',
          'src/__tests__/**',
          'src/__mocks__/**',
          '.next/**',
          'out/**',
          'dist/**',
          'node_modules/**',
        ],
      },
    },

    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },
  })
);