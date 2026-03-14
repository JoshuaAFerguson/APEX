/**
 * Vitest configuration for @apexcli/core package
 *
 * Uses shared configuration with unit test optimizations
 * for fast test execution with proper MockServer test coverage
 */
import { defineConfig, mergeConfig } from 'vitest/config';
import { createUnitTestConfig } from '../../vitest.shared.config.js';

export default mergeConfig(
  createUnitTestConfig({
    testTimeout: 10000, // Increased timeout for MockServer network tests
    hookTimeout: 15000,
    coverageThresholds: {
      lines: 75,
      functions: 75,
      branches: 60,
      statements: 75,
    },
    additionalIncludes: [
      // Include all test files in src directory
      'src/**/*.test.ts',
      'src/__tests__/**/*.test.ts',
      'src/test-utils/__tests__/**/*.test.ts',
      'src/test-fixtures/__tests__/**/*.test.ts',
    ],
  }),
  defineConfig({
    test: {
      // Additional test environment configuration for MockServer
      environment: 'node',
      globals: true,

      // Ensure proper cleanup for MockServer tests
      setupFiles: [],

      // Parallel execution for faster testing
      pool: 'forks',
      singleFork: false,
      poolOptions: {
        forks: {
          maxForks: Math.max(2, Math.floor(require('os').cpus().length / 4)),
          minForks: 1,
        },
      },
    },
  })
);