/**
 * Vitest configuration for @apex/orchestrator package
 *
 * Uses shared configuration with integration test optimizations
 * for handling async operations and real dependencies
 */
import { defineConfig, mergeConfig } from 'vitest/config';
import { createIntegrationTestConfig } from '../../vitest.shared.config.js';

export default mergeConfig(
  createIntegrationTestConfig({
    testTimeout: 30000, // Increased timeout for async operations
    hookTimeout: 30000,
    coverageThresholds: {
      lines: 70,
      functions: 70,
      branches: 60,
      statements: 70,
    },
  }),
  defineConfig({
    test: {
      // Orchestrator-specific setup
      setupFiles: ['../../test-setup.ts'],

      // Pool configuration for better async handling
      pool: 'threads',
      maxConcurrency: 5,

      // Package-specific coverage configuration
      coverage: {
        include: ['src/**/*.ts'],
        exclude: [
          'src/**/*.test.ts',
          'src/**/*.integration.test.ts',
          'src/**/*.e2e.test.ts',
          'src/**/*.d.ts',
          'src/__tests__/**',
          'src/__mocks__/**',
          'src/test-project-enhanced/**', // Exclude test project
          'dist/**',
          'node_modules/**',
        ],
      },
    },

    resolve: {
      alias: {
        '@apex/core': '../core/src',
        '@': '../core/src',
      },
    },
  })
);