/**
 * @fileoverview Shared Vitest configuration for APEX monorepo
 *
 * This base configuration provides:
 * - Common test environment settings
 * - TypeScript support
 * - Shared coverage settings
 * - Standard include/exclude patterns
 * - Environment-specific overrides
 *
 * Usage in package configs:
 * ```typescript
 * import { defineConfig, mergeConfig } from 'vitest/config';
 * import { createSharedConfig } from '../../vitest.shared.config.js';
 *
 * export default mergeConfig(
 *   createSharedConfig('node'),
 *   defineConfig({
 *     // package-specific overrides
 *   })
 * );
 * ```
 */

import { defineConfig } from 'vitest/config';
import * as path from 'path';

/**
 * Test environment options
 */
export type TestEnvironment = 'node' | 'jsdom' | 'happy-dom';

/**
 * Base configuration options
 */
export interface SharedConfigOptions {
  /** Test environment (default: 'node') */
  environment?: TestEnvironment;
  /** Enable globals like describe, it, expect (default: true) */
  globals?: boolean;
  /** Test timeout in milliseconds (default: 5000) */
  testTimeout?: number;
  /** Hook timeout in milliseconds (default: 10000) */
  hookTimeout?: number;
  /** Coverage threshold percentages (default: 50) */
  coverageThresholds?: {
    lines?: number;
    functions?: number;
    branches?: number;
    statements?: number;
  };
  /** Additional include patterns */
  additionalIncludes?: string[];
  /** Additional exclude patterns */
  additionalExcludes?: string[];
}

/**
 * Creates a shared Vitest configuration with common settings
 */
export function createSharedConfig(
  environment: TestEnvironment = 'node',
  options: SharedConfigOptions = {}
) {
  const {
    globals = true,
    testTimeout = 5000,
    hookTimeout = 10000,
    coverageThresholds = {
      lines: 50,
      functions: 50,
      branches: 50,
      statements: 50,
    },
    additionalIncludes = [],
    additionalExcludes = [],
  } = options;

  return defineConfig({
    test: {
      globals,
      environment,
      testTimeout,
      hookTimeout,

      // Standard include patterns for all test types
      include: [
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/**/*.unit.test.ts',
        'src/**/*.integration.test.ts',
        'src/**/*.e2e.test.ts',
        '__tests__/**/*.test.ts',
        '__tests__/**/*.test.tsx',
        ...additionalIncludes,
      ],

      // Standard exclude patterns
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/coverage/**',
        '**/*.d.ts',
        ...additionalExcludes,
      ],

      // Environment-specific settings
      ...(environment === 'node' && {
        environmentMatchGlobs: [
          ['**/src/**', 'node'],
          ['**/__tests__/**', 'node'],
        ],
      }),

      // Coverage configuration
      coverage: {
        provider: 'v8',
        reporter: ['text', 'text-summary', 'html', 'json', 'lcov'],
        reportsDirectory: './coverage',

        include: ['src/**/*.ts', 'src/**/*.tsx'],

        exclude: [
          '**/*.test.ts',
          '**/*.test.tsx',
          '**/*.unit.test.ts',
          '**/*.integration.test.ts',
          '**/*.e2e.test.ts',
          '**/*.spec.ts',
          '**/*.spec.tsx',
          '**/*.d.ts',
          '**/node_modules/**',
          '**/dist/**',
          '**/coverage/**',
          '**/__tests__/**',
          '**/__mocks__/**',
          '**/test-fixtures/**',
        ],

        thresholds: {
          global: coverageThresholds,
        },
      },
    },

    // Resolve aliases for easier imports
    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), './src'),
        '@tests': path.resolve(process.cwd(), './__tests__'),
        '@fixtures': path.resolve(process.cwd(), './__tests__/fixtures'),
      },
    },
  });
}

/**
 * Creates configuration for unit tests specifically
 * - Fast execution
 * - Isolated environment
 * - Mock-heavy
 */
export function createUnitTestConfig(options: SharedConfigOptions = {}) {
  return createSharedConfig('node', {
    testTimeout: 5000,
    ...options,
    additionalIncludes: [
      'src/**/*.test.ts',
      'src/**/*.unit.test.ts',
      ...(options.additionalIncludes || []),
    ],
    additionalExcludes: [
      '**/*.e2e.test.ts',
      '**/*.integration.test.ts',
      '**/*.stress.test.ts',
      '**/*.edge.test.ts',
      ...(options.additionalExcludes || []),
    ],
  });
}

/**
 * Creates configuration for integration tests
 * - Extended timeouts
 * - Real dependencies
 * - Database/filesystem access
 */
export function createIntegrationTestConfig(options: SharedConfigOptions = {}) {
  return createSharedConfig('node', {
    testTimeout: 30000,
    hookTimeout: 30000,
    ...options,
    additionalIncludes: [
      'src/**/*.integration.test.ts',
      'tests/integration/**/*.test.ts',
      ...(options.additionalIncludes || []),
    ],
  });
}

/**
 * Creates configuration for E2E tests
 * - Very long timeouts
 * - Real system operations
 * - Full service stack
 */
export function createE2ETestConfig(options: SharedConfigOptions = {}) {
  return createSharedConfig('node', {
    testTimeout: 60000,
    hookTimeout: 30000,
    ...options,
    additionalIncludes: [
      'src/**/*.e2e.test.ts',
      'tests/e2e/**/*.test.ts',
      ...(options.additionalIncludes || []),
    ],
  });
}

/**
 * Creates configuration for browser/UI tests
 * - jsdom or happy-dom environment
 * - DOM utilities
 * - Component testing
 */
export function createBrowserTestConfig(
  environment: 'jsdom' | 'happy-dom' = 'jsdom',
  options: SharedConfigOptions = {}
) {
  return createSharedConfig(environment, {
    testTimeout: 10000,
    ...options,
    additionalIncludes: [
      'src/**/*.test.tsx',
      'src/**/*.component.test.ts',
      'src/**/*.ui.test.ts',
      ...(options.additionalIncludes || []),
    ],
  });
}